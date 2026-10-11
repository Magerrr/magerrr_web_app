// Format turnamen di satu sesi: sistem gugur, round robin, atau grup + gugur. ALGORITHMS.md belum
// mendefinisikannya; aturan di bawah dicatat di docs/DECISIONS.md. Keadaan selalu diturunkan dari peserta
// (ber-seed, ber-grup) + match yang tertaut ke slot bagan / pasangan seed.
//  - Grup + gugur: peserta dibagi ke grup secara ular menurut seed (1–G ke grup A…, G+1–2G kembali dari grup
//    terakhir, …) sehingga unggulan tersebar. Tiap grup round robin; `advance` teratas tiap grup lolos ke bagan
//    gugur ukuran G × advance (tanpa bye). Juara grup tidak bertemu runner-up grup yang sama sebelum final.
//  - Posisi di bagan baru terisi setelah semua match grupnya selesai.
//  - Peringkat akhir yang gugur di fase grup: peringkat ke-p di grup → bagan + 1 + (p − advance − 1) × G (bersama).
import {
  BYE,
  MAX_ENTRIES,
  bracketSize,
  buildBracket,
  buildBracketFrom,
  knockoutResults,
  placements,
  seedPositions,
  slotName,
  type Bracket,
  type Entry,
  type SlotMatch,
  type SlotState,
} from "./bracket";
import { buildPool, fixtureCount, type Pool, type PoolMatch } from "./roundrobin";
import type { GameScore, MatchStatus, Side, Teams } from "./types";

export const TOURNAMENT_FORMATS = ["knockout", "round_robin", "groups_knockout"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const GROUP_COUNTS = [2, 4, 8] as const;
export const ADVANCE_COUNTS = [1, 2] as const;
export interface GroupSetup {
  count: (typeof GROUP_COUNTS)[number];
  /** jumlah peserta teratas tiap grup yang lolos ke bagan */
  advance: (typeof ADVANCE_COUNTS)[number];
}

export const ROUND_ROBIN_MIN = 3;
export const ROUND_ROBIN_MAX = 12;
export const GROUP_MAX_SIZE = 8;

export interface TournamentSpec {
  format: TournamentFormat;
  entries: Entry[];
  /** wajib untuk grup + gugur, selain itu null */
  groups: GroupSetup | null;
}

/** Tautan match ke turnamen: slot bagan gugur atau pasangan seed round robin / grup (a < b). */
export type TournamentLink = { stage: "knockout"; round: number; slot: number } | { stage: "pool"; a: number; b: number };

export interface LinkedMatch {
  link: TournamentLink;
  matchId: string;
  status: Exclude<MatchStatus, "void">;
  players: Teams;
  games: GameScore[];
  winner: Side | null;
}

/** Asal peserta di posisi babak 1 bagan grup + gugur. */
export interface Source {
  /** 0 = Grup A */
  group: number;
  /** 1 = juara grup, 2 = runner-up */
  place: number;
}

export interface Standing {
  seed: number;
  /** peringkat akhir; null = masih bertanding */
  place: number | null;
  won: number;
  lost: number;
  /** peringkat di grup bagi yang gugur di fase grup */
  groupPlace: number | null;
}

export interface TournamentState {
  /** round robin: satu; grup + gugur: satu per grup; sistem gugur: kosong */
  pools: Pool[];
  bracket: Bracket | null;
  /** asal tiap posisi babak 1 bagan (grup + gugur) */
  sources: Source[] | null;
  champion: number | null;
  /** urut peringkat (yang masih bertanding di akhir), lalu seed; round robin berjalan: urut klasemen sementara */
  standings: Standing[];
}

export const groupLetter = (group: number) => String.fromCharCode(65 + group);

/** Pesan bila jumlah peserta tidak cocok dengan format; null = sah. */
export function formatProblem(format: TournamentFormat, entryCount: number, groups: GroupSetup | null): string | null {
  if (entryCount > MAX_ENTRIES) return `Maksimal ${MAX_ENTRIES} peserta.`;
  switch (format) {
    case "knockout":
      return entryCount < 2 ? "Butuh minimal 2 peserta." : null;
    case "round_robin":
      if (entryCount < ROUND_ROBIN_MIN) return `Round robin butuh minimal ${ROUND_ROBIN_MIN} peserta.`;
      if (entryCount > ROUND_ROBIN_MAX) return `Round robin maksimal ${ROUND_ROBIN_MAX} peserta (${fixtureCount(ROUND_ROBIN_MAX)} match). Pakai grup + gugur.`;
      return null;
    case "groups_knockout": {
      if (!groups) return "Pilih jumlah grup.";
      const min = groups.count * (groups.advance + 1);
      if (entryCount < min) return `${groups.count} grup dengan ${groups.advance} lolos per grup butuh minimal ${min} peserta.`;
      if (entryCount > groups.count * GROUP_MAX_SIZE) {
        return `${groups.count} grup maksimal ${groups.count * GROUP_MAX_SIZE} peserta (${GROUP_MAX_SIZE} per grup). Tambah jumlah grup.`;
      }
      return null;
    }
  }
}

/** Grup (0 = A) tiap seed secara ular: indeks i = seed i + 1. */
export function snakeGroups(entryCount: number, groupCount: number): number[] {
  return Array.from({ length: entryCount }, (_, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    return row % 2 === 0 ? col : groupCount - 1 - col;
  });
}

/**
 * Asal posisi babak 1 bagan, atas ke bawah. Juara grup mengikuti urutan seed standar grup; dengan 2 lolos,
 * tiap juara grup melawan runner-up grup yang juaranya ada di paruh bagan lain → dua peserta dari grup yang
 * sama baru bisa bertemu di final.
 */
export function knockoutSources({ count, advance }: GroupSetup): Source[] {
  const order = seedPositions(count).map((g) => g - 1);
  if (advance === 1) return order.map((group) => ({ group, place: 1 }));
  return order.flatMap((group, k) => [
    { group, place: 1 },
    { group: order[(k + count / 2) % count], place: 2 },
  ]);
}

/** Ukuran bagan gugur (0 = tanpa bagan). */
export function knockoutSize(spec: Pick<TournamentSpec, "format" | "groups">, entryCount: number): number {
  if (spec.format === "knockout") return bracketSize(entryCount);
  if (spec.format === "groups_knockout") return spec.groups!.count * spec.groups!.advance;
  return 0;
}

/** Label match di papan skor / jadwal: "Semifinal 1", "Grup A", "Round robin". */
export function linkLabel(spec: TournamentSpec, link: TournamentLink): string {
  if (link.stage === "knockout") return slotName(link.round, link.slot, Math.log2(knockoutSize(spec, spec.entries.length)));
  if (spec.format === "groups_knockout") return `Grup ${groupLetter(spec.entries[link.a - 1]?.group ?? 0)}`;
  return "Round robin";
}

const byPlace = (x: Standing, y: Standing) => (x.place ?? Infinity) - (y.place ?? Infinity) || x.seed - y.seed;

export function buildTournament(spec: TournamentSpec, matches: LinkedMatch[]): TournamentState {
  const slotMatches: SlotMatch[] = [];
  const poolMatches: PoolMatch[] = [];
  for (const { link, ...m } of matches) {
    if (link.stage === "knockout") slotMatches.push({ ...m, round: link.round, slot: link.slot });
    else poolMatches.push({ ...m, a: link.a, b: link.b });
  }
  const { entries } = spec;

  if (spec.format === "knockout") {
    const bracket = buildBracket(entries, slotMatches);
    const standings = placements(bracket, entries.length).map((p) => ({ ...p, groupPlace: null }));
    return { pools: [], bracket, sources: null, champion: bracket.champion, standings };
  }

  if (spec.format === "round_robin") {
    const pool = buildPool(
      entries.map((e) => e.seed),
      entries,
      poolMatches,
    );
    const standings = pool.table.map((r) => ({ seed: r.seed, place: pool.complete ? r.place : null, won: r.won, lost: r.lost, groupPlace: null }));
    return { pools: [pool], bracket: null, sources: null, champion: pool.complete ? pool.table[0].seed : null, standings };
  }

  const setup = spec.groups;
  if (!setup || entries.some((e) => e.group === undefined || e.group < 0 || e.group >= setup.count)) {
    throw new RangeError("Grup peserta tidak sah.");
  }
  const pools = Array.from({ length: setup.count }, (_, g) =>
    buildPool(
      entries.filter((e) => e.group === g).map((e) => e.seed),
      entries,
      poolMatches,
    ),
  );
  const sources = knockoutSources(setup);
  const positions = sources.map(({ group, place }) => (pools[group].complete ? (pools[group].table[place - 1]?.seed ?? BYE) : null));
  const bracket = buildBracketFrom(entries, positions, slotMatches);
  const knockout = knockoutResults(bracket);
  const size = setup.count * setup.advance;
  const standings = entries.map((e): Standing => {
    const pool = pools[e.group!];
    const row = pool.table.find((r) => r.seed === e.seed)!;
    const ko = knockout.get(e.seed);
    const out = pool.complete && row.place > setup.advance;
    return {
      seed: e.seed,
      place: out ? size + 1 + (row.place - setup.advance - 1) * setup.count : (ko?.place ?? null),
      won: row.won + (ko?.won ?? 0),
      lost: row.lost + (ko?.lost ?? 0),
      groupPlace: out ? row.place : null,
    };
  });
  return { pools, bracket, sources, champion: bracket.champion, standings: standings.sort(byPlace) };
}

export interface ScheduleItem {
  key: string;
  /** nomor partai round robin / grup (mulai 1, urut main); null untuk bagan */
  no: number | null;
  link: TournamentLink;
  /** grup (0 = A) untuk match fase grup; null selain itu */
  group: number | null;
  /** ronde jadwal (round robin / grup) atau babak bagan */
  round: number;
  a: number | null;
  b: number | null;
  state: SlotState;
  winner: number | null;
  match: { matchId: string; games: GameScore[] } | null;
}

/**
 * Semua match dalam urutan main: round robin / grup per ronde (grup A, B, … di tiap ronde), lalu bagan per
 * babak. Bye tidak ikut.
 */
export function schedule(state: TournamentState, format: TournamentFormat): ScheduleItem[] {
  const pool = state.pools
    .flatMap((p, g) =>
      p.fixtures.map((f, i) => ({
        order: [f.round, g, i],
        item: {
          key: `p:${f.a}:${f.b}`,
          no: null as number | null,
          link: { stage: "pool", a: f.a, b: f.b },
          group: format === "groups_knockout" ? g : null,
          round: f.round,
          a: f.a,
          b: f.b,
          state: f.state,
          winner: f.winner,
          match: f.match,
        } satisfies ScheduleItem,
      })),
    )
    .sort((x, y) => x.order[0] - y.order[0] || x.order[1] - y.order[1] || x.order[2] - y.order[2])
    .map((x, i) => ({ ...x.item, no: i + 1 }));
  const knockout = (state.bracket?.rounds.flat() ?? [])
    .filter((s) => s.state !== "bye")
    .map(
      (s): ScheduleItem => ({
        key: `k:${s.round}:${s.slot}`,
        no: null,
        link: { stage: "knockout", round: s.round, slot: s.slot },
        group: null,
        round: s.round,
        a: s.a,
        b: s.b,
        state: s.state,
        winner: s.winner,
        match: s.match,
      }),
    );
  return [...pool, ...knockout];
}
