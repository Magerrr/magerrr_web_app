// Mode `kocok` — pasangan berganti tiap ronde (docs/ALGORITHMS.md §4.2). PRD: SC10, G9.
// Acak hanya lewat PRNG ber-seed agar ronde bisa direproduksi.
import { compareId, type MatchKind, type MatchRecord, type MemberId, type Teams } from "./types";

export type Grade = "A" | "B" | "C" | "D";

const GRADE_RATING: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1 };

/** Rating untuk kocok: grade bila ada, selain itu 1 + 3·winRate (pemain baru 0.5 → 2.5). */
export function playerRating(grade?: Grade | null, stats?: { played: number; won: number }): number {
  if (grade) return GRADE_RATING[grade];
  const winRate = stats && stats.played > 0 ? stats.won / stats.played : 0.5;
  return 1 + 3 * winRate;
}

/** PRNG 32-bit deterministik; mengembalikan fungsi yang menghasilkan bilangan di [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KocokPlayer {
  id: MemberId;
  rating: number;
  playedThisSession: number;
  roundsSinceLastPlayed: number;
}

/** Riwayat pasangan; fungsi harus simetris (a, b) = (b, a). */
export interface PairHistory {
  partnerCountSession(a: MemberId, b: MemberId): number;
  partnerCountAllTime(a: MemberId, b: MemberId): number;
  /** berapa kali a dan b saling berhadapan (disarankan: di sesi ini) */
  opponentCount(a: MemberId, b: MemberId): number;
}

export const EMPTY_HISTORY: PairHistory = {
  partnerCountSession: () => 0,
  partnerCountAllTime: () => 0,
  opponentCount: () => 0,
};

export interface PlanInput {
  players: KocokPlayer[];
  /** jumlah lapangan kosong */
  courts: number;
  format: MatchKind;
  history?: PairHistory;
}

export type PlanHint = "kurang pemain" | "bisa tunggal" | "tidak ada lapangan";

export interface RoundPlan {
  courts: Teams[];
  /** urut prioritas main berikutnya */
  resting: MemberId[];
  hint?: PlanHint;
}

export const COST_WEIGHTS = { partnerSession: 10, partnerAllTime: 1, balance: 3, opponent: 1 } as const;
const MAX_ITERATIONS = 500;
const EPS = 1e-9;

const pairKey = (a: MemberId, b: MemberId) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

function memoPair(fn: (a: MemberId, b: MemberId) => number) {
  const cache = new Map<string, number>();
  return (a: MemberId, b: MemberId) => {
    const key = pairKey(a, b);
    let value = cache.get(key);
    if (value === undefined) cache.set(key, (value = fn(a, b)));
    return value;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function planRound(input: PlanInput, seed: number): RoundPlan {
  const { players, courts, format } = input;
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new RangeError("pemain ganda dalam daftar");
  }
  const rng = mulberry32(seed);
  const perMatch = format === "doubles" ? 4 : 2;
  const n = players.length;
  const m = Math.min(Math.max(0, Math.floor(courts)), Math.floor(n / perMatch));

  // 2. Pilih pemain: paling sedikit main dulu, lalu paling lama istirahat, lalu acak ber-seed.
  const ordered = players
    .map((p) => ({ p, r: rng() }))
    .sort(
      (x, y) =>
        x.p.playedThisSession - y.p.playedThisSession ||
        y.p.roundsSinceLastPlayed - x.p.roundsSinceLastPlayed ||
        x.r - y.r ||
        compareId(x.p.id, y.p.id),
    )
    .map((x) => x.p);

  if (m === 0) {
    const hint: PlanHint =
      courts < 1
        ? "tidak ada lapangan"
        : format === "doubles" && (n === 2 || n === 3)
          ? "bisa tunggal"
          : "kurang pemain";
    return { courts: [], resting: ordered.map((p) => p.id), hint };
  }

  const playing = ordered.slice(0, m * perMatch);
  const resting = ordered.slice(m * perMatch).map((p) => p.id);

  // 3. Susun tim dengan cost minimal.
  const history = input.history ?? EMPTY_HISTORY;
  const partnerSession = memoPair(history.partnerCountSession);
  const partnerAllTime = memoPair(history.partnerCountAllTime);
  const opponent = memoPair(history.opponentCount);
  const rating = new Map(playing.map((p) => [p.id, p.rating]));
  const r = (id: MemberId) => rating.get(id)!;
  const teamSize = perMatch / 2;

  const cost = (arr: MemberId[]): number => {
    let total = 0;
    for (let k = 0; k < m; k++) {
      const A = arr.slice(k * perMatch, k * perMatch + teamSize);
      const B = arr.slice(k * perMatch + teamSize, (k + 1) * perMatch);
      for (const team of [A, B]) {
        if (team.length === 2) {
          total +=
            COST_WEIGHTS.partnerSession * partnerSession(team[0], team[1]) +
            COST_WEIGHTS.partnerAllTime * partnerAllTime(team[0], team[1]);
        }
      }
      const avg = (team: MemberId[]) => team.reduce((s, id) => s + r(id), 0) / team.length;
      total += COST_WEIGHTS.balance * Math.abs(avg(A) - avg(B));
      for (const a of A) for (const b of B) total += COST_WEIGHTS.opponent * opponent(a, b);
    }
    return total;
  };

  let arr: MemberId[];
  if (format === "doubles" && m === 1) {
    const [a, b, c, d] = playing.map((p) => p.id);
    const options = [
      [a, b, c, d],
      [a, c, b, d],
      [a, d, b, c],
    ];
    arr = options.reduce((best, opt) => (cost(opt) < cost(best) - EPS ? opt : best));
  } else {
    arr =
      format === "doubles"
        ? shuffle(
            playing.map((p) => p.id),
            rng,
          )
        : [...playing].sort((x, y) => y.rating - x.rating).map((p) => p.id);
    localSearch(arr, teamSize, cost);
  }

  const result: Teams[] = [];
  for (let k = 0; k < m; k++) {
    result.push({
      A: arr.slice(k * perMatch, k * perMatch + teamSize),
      B: arr.slice(k * perMatch + teamSize, (k + 1) * perMatch),
    });
  }
  return { courts: result, resting };
}

/** Tukar dua pemain mana pun selama cost turun (perbaikan terbaik per iterasi), maks 500 iterasi. */
function localSearch(arr: MemberId[], teamSize: number, cost: (arr: MemberId[]) => number): void {
  const swap = (i: number, j: number) => ([arr[i], arr[j]] = [arr[j], arr[i]]);
  let current = cost(arr);
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let best = { i: -1, j: -1, cost: current };
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (Math.floor(i / teamSize) === Math.floor(j / teamSize)) continue; // satu tim: cost sama
        swap(i, j);
        const c = cost(arr);
        swap(i, j);
        if (c < best.cost - EPS) best = { i, j, cost: c };
      }
    }
    if (best.i < 0) return;
    swap(best.i, best.j);
    current = best.cost;
  }
}

function countPairs(matches: MatchRecord[], partners: boolean): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (a: MemberId, b: MemberId) => counts.set(pairKey(a, b), (counts.get(pairKey(a, b)) ?? 0) + 1);
  for (const { players } of matches) {
    if (partners) {
      for (const team of [players.A, players.B]) if (team.length === 2) bump(team[0], team[1]);
    } else {
      for (const a of players.A) for (const b of players.B) bump(a, b);
    }
  }
  return counts;
}

/**
 * Input planRound dari data match (§4.2): main di sesi ini (match selesai), ronde sejak terakhir main,
 * rating (grade atau win rate ganda all-time), dan riwayat pasangan/lawan. Match `void` diabaikan;
 * match yang sedang berjalan dihitung untuk riwayat pasangan sesi, bukan untuk jumlah main.
 */
export function kocokContext({
  candidates,
  sessionMatches,
  groupMatches,
}: {
  candidates: { id: MemberId; grade: Grade | null }[];
  sessionMatches: MatchRecord[];
  groupMatches: MatchRecord[];
}): { players: KocokPlayer[]; history: PairHistory } {
  const live = sessionMatches.filter((m) => m.status !== "void");
  const done = live.filter((m) => m.status === "completed").sort((x, y) => x.order - y.order);
  const allTime = groupMatches.filter((m) => m.status === "completed" && m.kind === "doubles");
  const onSide = (m: MatchRecord, id: MemberId) => (m.players.A.includes(id) ? "A" : m.players.B.includes(id) ? "B" : null);

  const players = candidates.map(({ id, grade }) => {
    let lastIndex = -1;
    done.forEach((m, i) => {
      if (onSide(m, id)) lastIndex = i;
    });
    const stats = allTime.reduce(
      (s, m) => {
        const side = onSide(m, id);
        return side ? { played: s.played + 1, won: s.won + (m.winner === side ? 1 : 0) } : s;
      },
      { played: 0, won: 0 },
    );
    return {
      id,
      rating: playerRating(grade, stats),
      playedThisSession: done.filter((m) => onSide(m, id)).length,
      roundsSinceLastPlayed: lastIndex < 0 ? done.length + 1 : done.length - lastIndex - 1,
    };
  });

  const partnersSession = countPairs(live, true);
  const partnersAllTime = countPairs(allTime, true);
  const opponents = countPairs(live, false);
  return {
    players,
    history: {
      partnerCountSession: (a, b) => partnersSession.get(pairKey(a, b)) ?? 0,
      partnerCountAllTime: (a, b) => partnersAllTime.get(pairKey(a, b)) ?? 0,
      opponentCount: (a, b) => opponents.get(pairKey(a, b)) ?? 0,
    },
  };
}
