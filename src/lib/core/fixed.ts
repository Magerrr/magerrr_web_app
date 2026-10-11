// Mode `fix_pasangan` (PRD SC10c): pasangan tetap sepanjang sesi, lawan berganti tiap ronde.
// ALGORITHMS.md belum mendefinisikan mode ini; aturan di bawah dicatat di docs/DECISIONS.md (Fase 9).
//  - Pasangan otomatis: urut rating ↓ (id ↑), terkuat dipasangkan dengan terlemah (tim seimbang).
//  - Ronde: pasangan dipilih seperti kocok (paling sedikit main → paling lama istirahat → acak ber-seed),
//    lalu dipertemukan dengan cost minimal: 10 × pernah berhadapan di sesi + 3 × |selisih rating tim|.
import { mulberry32 } from "./kocok";
import { compareId, type MatchRecord, type MemberId, type Teams } from "./types";

export type Pair = [MemberId, MemberId];

export interface FixedPairState {
  members: Pair;
  /** rata-rata rating dua pemain (sama dengan tim kocok) */
  rating: number;
  playedThisSession: number;
  roundsSinceLastPlayed: number;
}

export interface FixedPlan {
  courts: Teams[];
  /** pasangan yang istirahat, urut prioritas main berikutnya */
  resting: Pair[];
  hint?: "kurang pemain" | "tidak ada lapangan";
}

export const FIXED_WEIGHTS = { opponent: 10, balance: 3 } as const;
/** Pencarian semua kemungkinan pertemuan hanya sampai 12 pasangan (10.395 susunan). */
const BRUTE_FORCE_MAX = 12;

export const pairKey = ([a, b]: Pair) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const sortedPair = ([a, b]: Pair): Pair => (compareId(a, b) <= 0 ? [a, b] : [b, a]);

/** Pasangan seimbang: rating ↓ (seri id ↑), ke-i dengan ke-(n−1−i). Sisa ganjil tidak berpasangan. */
export function autoPairs(players: { id: MemberId; rating: number }[]): { pairs: Pair[]; unpaired: MemberId[] } {
  const ordered = [...players].sort((x, y) => y.rating - x.rating || compareId(x.id, y.id));
  const unpaired = ordered.length % 2 === 1 ? [ordered.splice(Math.floor(ordered.length / 2), 1)[0].id] : [];
  const pairs: Pair[] = [];
  for (let i = 0; i < ordered.length / 2; i++) pairs.push(sortedPair([ordered[i].id, ordered[ordered.length - 1 - i].id]));
  return { pairs, unpaired };
}

/** Validasi daftar pasangan: dua pemain berbeda, tidak ada pemain di dua pasangan. */
export function assertValidPairs(pairs: Pair[]): void {
  const seen = new Set<MemberId>();
  for (const [a, b] of pairs) {
    if (a === b) throw new RangeError("Satu pasangan butuh dua pemain berbeda.");
    for (const id of [a, b]) {
      if (seen.has(id)) throw new RangeError("Satu pemain tidak boleh ada di dua pasangan.");
      seen.add(id);
    }
  }
}

const sameTeam = (team: MemberId[], pair: Pair) => team.length === 2 && team.includes(pair[0]) && team.includes(pair[1]);

/** Status tiap pasangan dari match sesi ini (match void diabaikan; berjalan dihitung sebagai pertemuan). */
export function fixedContext({
  pairs,
  ratings,
  sessionMatches,
}: {
  pairs: Pair[];
  ratings: Map<MemberId, number>;
  sessionMatches: MatchRecord[];
}): { states: FixedPairState[]; opponentCount: (p: Pair, q: Pair) => number } {
  const live = sessionMatches.filter((m) => m.status !== "void");
  const done = live.filter((m) => m.status === "completed").sort((x, y) => x.order - y.order);
  const states = pairs.map((pair) => {
    let last = -1;
    done.forEach((m, i) => {
      if (sameTeam(m.players.A, pair) || sameTeam(m.players.B, pair)) last = i;
    });
    return {
      members: sortedPair(pair),
      rating: ((ratings.get(pair[0]) ?? 0) + (ratings.get(pair[1]) ?? 0)) / 2,
      playedThisSession: done.filter((m) => sameTeam(m.players.A, pair) || sameTeam(m.players.B, pair)).length,
      roundsSinceLastPlayed: last < 0 ? done.length + 1 : done.length - last - 1,
    };
  });
  const met = new Map<string, number>();
  for (const m of live) {
    const a = pairs.find((p) => sameTeam(m.players.A, p));
    const b = pairs.find((p) => sameTeam(m.players.B, p));
    if (!a || !b) continue;
    const key = [pairKey(a), pairKey(b)].sort().join("~");
    met.set(key, (met.get(key) ?? 0) + 1);
  }
  return { states, opponentCount: (p, q) => met.get([pairKey(p), pairKey(q)].sort().join("~")) ?? 0 };
}

/** Semua cara mempertemukan pasangan berindeks 0..n−1 (n genap), urutan deterministik. */
function* matchings(n: number): Generator<[number, number][]> {
  const rec = function* (rest: number[]): Generator<[number, number][]> {
    if (rest.length === 0) return yield [];
    const [first, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      const remaining = others.filter((_, j) => j !== i);
      for (const tail of rec(remaining)) yield [[first, others[i]], ...tail];
    }
  };
  yield* rec(Array.from({ length: n }, (_, i) => i));
}

export function planFixedRound(
  input: { pairs: FixedPairState[]; courts: number; opponentCount: (p: Pair, q: Pair) => number },
  seed: number,
): FixedPlan {
  const rng = mulberry32(seed);
  const ordered = input.pairs
    .map((p) => ({ p, r: rng() }))
    .sort(
      (x, y) =>
        x.p.playedThisSession - y.p.playedThisSession ||
        y.p.roundsSinceLastPlayed - x.p.roundsSinceLastPlayed ||
        x.r - y.r ||
        compareId(pairKey(x.p.members), pairKey(y.p.members)),
    )
    .map((x) => x.p);
  const courts = Math.min(Math.max(0, Math.floor(input.courts)), Math.floor(ordered.length / 2));
  if (courts === 0) {
    return { courts: [], resting: ordered.map((p) => p.members), hint: input.courts < 1 ? "tidak ada lapangan" : "kurang pemain" };
  }
  const playing = ordered.slice(0, courts * 2);
  const resting = ordered.slice(courts * 2).map((p) => p.members);
  const cost = (x: FixedPairState, y: FixedPairState) =>
    FIXED_WEIGHTS.opponent * input.opponentCount(x.members, y.members) + FIXED_WEIGHTS.balance * Math.abs(x.rating - y.rating);

  let best: [number, number][] = [];
  if (playing.length <= BRUTE_FORCE_MAX) {
    let bestCost = Infinity;
    for (const m of matchings(playing.length)) {
      const total = m.reduce((s, [i, j]) => s + cost(playing[i], playing[j]), 0);
      if (total < bestCost - 1e-9) {
        bestCost = total;
        best = m;
      }
    }
  } else {
    // Banyak lapangan: rakus — pasangan teratas melawan kandidat dengan cost terkecil.
    const left = playing.map((_, i) => i);
    while (left.length > 0) {
      const i = left.shift()!;
      let pick = 0;
      for (let k = 1; k < left.length; k++) if (cost(playing[i], playing[left[k]]) < cost(playing[i], playing[left[pick]])) pick = k;
      best.push([i, left.splice(pick, 1)[0]]);
    }
  }
  return { courts: best.map(([i, j]) => ({ A: [...playing[i].members], B: [...playing[j].members] })), resting };
}
