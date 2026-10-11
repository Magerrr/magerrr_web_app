// Turnamen sistem gugur (bagan). ALGORITHMS.md belum mendefinisikannya; aturan di bawah dicatat di
// docs/DECISIONS.md. Keadaan bagan selalu diturunkan dari peserta (ber-seed) + match yang tertaut ke slot.
//  - Ukuran bagan = pangkat 2 terkecil ≥ jumlah peserta; posisi seed standar (1 vs 16, 8 vs 9, …) sehingga
//    bye jatuh ke seed teratas dan seed 1 & 2 baru bisa bertemu di final.
//  - Seeding: rating tim ↓ (seri diacak ber-seed), atau acak penuh ber-seed.
//  - Match di slot dihitung hanya bila timnya persis peserta slot itu; selain itu slot ditandai "konflik"
//    (mis. hasil babak sebelumnya diedit sehingga pemenangnya berubah).
import { mulberry32 } from "./kocok";
import type { GameScore, MatchStatus, MemberId, Side, Teams } from "./types";

export const MIN_ENTRIES = 2;
export const MAX_ENTRIES = 32;

/** Peserta turnamen: satu pemain (tunggal) atau dua (ganda). `seed` 1 = unggulan teratas. */
export interface Entry {
  seed: number;
  players: MemberId[];
  /** grup fase grup (0 = Grup A); hanya format grup + gugur */
  group?: number;
}

/** Match yang tertaut ke slot bagan (round 1 = babak pertama, slot mulai 0). */
export interface SlotMatch {
  round: number;
  slot: number;
  matchId: string;
  status: Exclude<MatchStatus, "void">;
  /** A = peserta atas slot, B = peserta bawah */
  players: Teams;
  games: GameScore[];
  winner: Side | null;
}

export type SlotState = "bye" | "waiting" | "ready" | "running" | "done" | "conflict";

export interface Slot {
  round: number;
  slot: number;
  /** seed peserta atas / bawah; null = bye (babak 1) atau belum diketahui */
  a: number | null;
  b: number | null;
  state: SlotState;
  /** seed pemenang (bye: peserta yang lolos otomatis) */
  winner: number | null;
  match: SlotMatch | null;
}

export interface Bracket {
  size: number;
  rounds: Slot[][];
  champion: number | null;
}

/** Pangkat 2 terkecil ≥ n (2…MAX_ENTRIES peserta). */
export function bracketSize(n: number): number {
  if (!Number.isInteger(n) || n < MIN_ENTRIES || n > MAX_ENTRIES) {
    throw new RangeError(`Turnamen butuh ${MIN_ENTRIES}–${MAX_ENTRIES} peserta.`);
  }
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

/** Seed di tiap posisi bagan, atas ke bawah: 4 → [1,4,2,3], 8 → [1,8,4,5,2,7,3,6]. */
export function seedPositions(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((s) => [s, next + 1 - s]);
  }
  return order;
}

/** "Final", "Semifinal", "Perempat final", lalu "Babak 16 besar", … */
export function roundName(round: number, roundCount: number): string {
  const left = roundCount - round;
  if (left === 0) return "Final";
  if (left === 1) return "Semifinal";
  if (left === 2) return "Perempat final";
  return `Babak ${2 ** (left + 1)} besar`;
}

/** "Semifinal 2", "Final" — label satu slot untuk jadwal & papan skor. */
export function slotName(round: number, slot: number, roundCount: number): string {
  const name = roundName(round, roundCount);
  return round === roundCount ? name : `${name} ${slot + 1}`;
}

const sameSet = (x: MemberId[], y: MemberId[]) => x.length === y.length && x.every((id) => y.includes(id));

/** Bagan sistem gugur standar: posisi babak 1 dari urutan seed, sisa posisi = bye. */
export function buildBracket(entries: Entry[], matches: SlotMatch[]): Bracket {
  const size = bracketSize(entries.length);
  return buildBracketFrom(entries, seedPositions(size).map((s) => (s <= entries.length ? s : BYE)), matches);
}

/** Posisi babak 1: seed peserta, `BYE`, atau null = belum diketahui (mis. menunggu hasil fase grup). */
export const BYE = "bye";
export type Position = number | typeof BYE | null;

/** Bagan dari posisi babak 1 yang diberikan (panjang = pangkat 2 ≥ 2). */
export function buildBracketFrom(entries: Entry[], positions: Position[], matches: SlotMatch[]): Bracket {
  const size = positions.length;
  if (size < 2 || !Number.isInteger(Math.log2(size))) throw new RangeError("Ukuran bagan harus pangkat 2.");
  const bySeed = new Map(entries.map((e) => [e.seed, e]));
  if (bySeed.size !== entries.length || entries.some((e) => e.seed < 1 || e.seed > entries.length)) {
    throw new RangeError("Seed peserta harus 1…n tanpa duplikat.");
  }
  const roundCount = Math.log2(size);
  const at = new Map(matches.map((m) => [`${m.round}:${m.slot}`, m]));
  const rounds: Slot[][] = [];

  for (let round = 1; round <= roundCount; round++) {
    const count = size / 2 ** round;
    const slots: Slot[] = [];
    for (let slot = 0; slot < count; slot++) {
      const match = at.get(`${round}:${slot}`) ?? null;
      if (round === 1) {
        const [pa, pb] = [positions[2 * slot], positions[2 * slot + 1]];
        if (pa === BYE || pb === BYE) {
          const a = pa === BYE ? null : pa;
          const b = pb === BYE ? null : pb;
          slots.push({ round, slot, a, b, match, state: match ? "conflict" : "bye", winner: a ?? b });
          continue;
        }
        slots.push(resolveSlot(round, slot, pa, pb, match, bySeed));
      } else {
        slots.push(resolveSlot(round, slot, rounds[round - 2][2 * slot].winner, rounds[round - 2][2 * slot + 1].winner, match, bySeed));
      }
    }
    rounds.push(slots);
  }
  return { size, rounds, champion: rounds[roundCount - 1][0].winner };
}

function resolveSlot(round: number, slot: number, a: number | null, b: number | null, match: SlotMatch | null, bySeed: Map<number, Entry>): Slot {
  const base = { round, slot, a, b, match };
  if (a === null || b === null) return { ...base, state: match ? "conflict" : "waiting", winner: null };
  if (!match) return { ...base, state: "ready", winner: null };
  const fits = sameSet(match.players.A, bySeed.get(a)!.players) && sameSet(match.players.B, bySeed.get(b)!.players);
  if (!fits) return { ...base, state: "conflict", winner: null };
  if (match.status === "running" || match.winner === null) return { ...base, state: "running", winner: null };
  return { ...base, state: "done", winner: match.winner === "A" ? a : b };
}

/** Slot yang bisa dimulai sekarang (kedua peserta diketahui, belum ada match). */
export function readySlots(bracket: Bracket): Slot[] {
  return bracket.rounds.flat().filter((s) => s.state === "ready");
}

export interface Placement {
  seed: number;
  /** 1 juara, 2 finalis, 3 semifinalis, 5 perempat finalis, …; null = masih bertanding */
  place: number | null;
  won: number;
  lost: number;
}

/** Peringkat akhir: kalah di babak r → peringkat 2^(jumlah babak − r) + 1 (bersama). Urut peringkat, lalu seed. */
export function placements(bracket: Bracket, entryCount: number): Placement[] {
  const rows = new Map<number, Placement>(Array.from({ length: entryCount }, (_, i) => [i + 1, { seed: i + 1, place: null, won: 0, lost: 0 }]));
  for (const [seed, result] of knockoutResults(bracket)) Object.assign(rows.get(seed)!, result);
  return [...rows.values()].sort((x, y) => (x.place ?? Infinity) - (y.place ?? Infinity) || x.seed - y.seed);
}

/** Menang/kalah & peringkat (bila sudah pasti) tiap seed yang pernah bertanding di bagan. */
export function knockoutResults(bracket: Bracket): Map<number, Omit<Placement, "seed">> {
  const roundCount = bracket.rounds.length;
  const rows = new Map<number, Omit<Placement, "seed">>();
  const row = (seed: number) => rows.get(seed) ?? rows.set(seed, { place: null, won: 0, lost: 0 }).get(seed)!;
  for (const slot of bracket.rounds.flat()) {
    if (slot.state !== "done" || slot.a === null || slot.b === null || slot.winner === null) continue;
    const loser = slot.winner === slot.a ? slot.b : slot.a;
    row(slot.winner).won++;
    const lost = row(loser);
    lost.lost++;
    lost.place = 2 ** (roundCount - slot.round) + 1;
  }
  if (bracket.champion !== null) row(bracket.champion).place = 1;
  return rows;
}

/** Urutan seed peserta: rating ↓ (seri acak ber-seed) atau acak penuh. Mengembalikan peserta dengan seed 1…n. */
export function seedEntries(teams: { players: MemberId[]; rating: number }[], method: "rating" | "random", seed: number): Entry[] {
  const random = mulberry32(seed);
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (method === "rating") shuffled.sort((x, y) => y.rating - x.rating); // sort stabil: seri tetap urutan acak
  return shuffled.map((t, i) => ({ seed: i + 1, players: t.players }));
}
