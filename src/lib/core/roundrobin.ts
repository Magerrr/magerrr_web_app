// Round robin (semua bertemu semua) untuk turnamen round robin dan fase grup. ALGORITHMS.md belum
// mendefinisikannya; aturan di bawah dicatat di docs/DECISIONS.md. Keadaan selalu diturunkan dari peserta
// + match yang tertaut ke pasangan seed (a < b); tim A match = peserta a.
//  - Jadwal: metode lingkaran (seed terkecil tetap, sisanya berputar); jumlah ganjil → satu peserta istirahat
//    tiap ronde.
//  - Peringkat (mengikuti aturan BWF): jumlah menang ↓. Dua peserta seri → hasil adu langsung. Tiga atau
//    lebih → selisih gim ↓, lalu selisih poin ↓; setiap kali tersisa dua yang seri → adu langsung. Masih
//    seri → seed ↑ (pengganti undian; seed acak bila unggulan diacak).
import type { Entry } from "./bracket";
import type { GameScore, MatchStatus, MemberId, Side, Teams } from "./types";

/** Match yang tertaut ke pasangan seed di round robin / grup (a < b). */
export interface PoolMatch {
  a: number;
  b: number;
  matchId: string;
  status: Exclude<MatchStatus, "void">;
  /** A = peserta a, B = peserta b */
  players: Teams;
  games: GameScore[];
  winner: Side | null;
}

export type FixtureState = "ready" | "running" | "done" | "conflict";

export interface Fixture {
  /** ronde jadwal (mulai 1) */
  round: number;
  a: number;
  b: number;
  state: FixtureState;
  /** seed pemenang */
  winner: number | null;
  match: PoolMatch | null;
}

export interface PoolRow {
  seed: number;
  /** 1…n, unik (seri dipecah aturan di atas) */
  place: number;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface Pool {
  seeds: number[];
  fixtures: Fixture[];
  table: PoolRow[];
  /** semua match selesai: peringkat sudah final */
  complete: boolean;
}

/** Jumlah match round robin satu kali putaran. */
export const fixtureCount = (n: number) => (n * (n - 1)) / 2;

/** Jumlah ronde: n − 1 (genap) atau n (ganjil, satu istirahat tiap ronde). */
export const roundCount = (n: number) => (n < 2 ? 0 : n % 2 === 0 ? n - 1 : n);

/** Jadwal metode lingkaran: tiap ronde daftar pasangan [a, b] dengan a < b; setiap pasangan tepat sekali. */
export function roundRobinRounds(seeds: number[]): [number, number][][] {
  const ring: (number | null)[] = seeds.length % 2 === 0 ? [...seeds] : [...seeds, null];
  const n = ring.length;
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const [x, y] = [ring[i], ring[n - 1 - i]];
      if (x !== null && y !== null) pairs.push([Math.min(x, y), Math.max(x, y)]);
    }
    rounds.push(pairs);
    ring.splice(1, 0, ring.pop()!); // posisi 0 tetap, sisanya berputar satu langkah
  }
  return rounds;
}

const sameSet = (x: MemberId[], y: MemberId[]) => x.length === y.length && x.every((id) => y.includes(id));

/** Satu grup / liga round robin: jadwal, keadaan tiap match, dan klasemen. */
export function buildPool(seeds: number[], entries: Entry[], matches: PoolMatch[]): Pool {
  const sorted = [...seeds].sort((x, y) => x - y);
  const bySeed = new Map(entries.map((e) => [e.seed, e]));
  const at = new Map(matches.map((m) => [`${m.a}:${m.b}`, m]));
  const fixtures = roundRobinRounds(sorted).flatMap((pairs, r) =>
    pairs.map(([a, b]): Fixture => {
      const match = at.get(`${a}:${b}`) ?? null;
      const base = { round: r + 1, a, b, match };
      if (!match) return { ...base, state: "ready", winner: null };
      const fits = sameSet(match.players.A, bySeed.get(a)!.players) && sameSet(match.players.B, bySeed.get(b)!.players);
      if (!fits) return { ...base, state: "conflict", winner: null };
      if (match.status === "running" || match.winner === null) return { ...base, state: "running", winner: null };
      return { ...base, state: "done", winner: match.winner === "A" ? a : b };
    }),
  );
  return { seeds: sorted, fixtures, table: rankPool(sorted, fixtures), complete: fixtures.every((f) => f.state === "done") };
}

/** Kelompokkan baris dengan nilai `key` sama, urut nilai ↓; urutan di dalam kelompok tetap. */
function splitBy<T>(rows: T[], key: (row: T) => number): T[][] {
  const values = [...new Set(rows.map(key))].sort((x, y) => y - x);
  return values.map((v) => rows.filter((r) => key(r) === v));
}

/** Klasemen dari match yang selesai (lihat aturan peringkat di atas). */
export function rankPool(seeds: number[], fixtures: Fixture[]): PoolRow[] {
  const rows = new Map(
    seeds.map((seed): [number, PoolRow] => [seed, { seed, place: 0, played: 0, won: 0, lost: 0, gamesWon: 0, gamesLost: 0, pointsFor: 0, pointsAgainst: 0 }]),
  );
  const beat = new Set<string>();
  for (const f of fixtures) {
    if (f.state !== "done" || f.winner === null || !f.match) continue;
    const [ra, rb] = [rows.get(f.a)!, rows.get(f.b)!];
    const loser = f.winner === f.a ? f.b : f.a;
    ra.played++;
    rb.played++;
    rows.get(f.winner)!.won++;
    rows.get(loser)!.lost++;
    beat.add(`${f.winner}>${loser}`);
    for (const g of f.match.games) {
      ra.pointsFor += g.a;
      ra.pointsAgainst += g.b;
      rb.pointsFor += g.b;
      rb.pointsAgainst += g.a;
      const [took, gave] = g.a > g.b ? [ra, rb] : g.b > g.a ? [rb, ra] : [null, null];
      if (took && gave) {
        took.gamesWon++;
        gave.gamesLost++;
      }
    }
  }
  const metrics = [(r: PoolRow) => r.gamesWon - r.gamesLost, (r: PoolRow) => r.pointsFor - r.pointsAgainst];
  const settle = (tied: PoolRow[], level: number): PoolRow[] => {
    if (tied.length === 1) return tied;
    if (tied.length === 2) {
      const [x, y] = tied;
      if (beat.has(`${x.seed}>${y.seed}`)) return [x, y];
      if (beat.has(`${y.seed}>${x.seed}`)) return [y, x];
    }
    if (level === metrics.length) return [...tied].sort((x, y) => x.seed - y.seed);
    return splitBy(tied, metrics[level]).flatMap((group) => settle(group, level + 1));
  };
  return splitBy([...rows.values()], (r) => r.won)
    .flatMap((tied) => settle(tied, 0))
    .map((row, i) => ({ ...row, place: i + 1 }));
}
