// Statistik per pemain: form, streak (PRD L6), head-to-head (L7). Diturunkan dari match setiap kali.
import { rallyTotals } from "./standings";
import { compareId, type MatchKind, type MatchRecord, type MemberId, type Side } from "./types";

export type Outcome = "W" | "L";

/** Match selesai yang diikuti pemain, kronologis: tanggal sesi ↑, urutan di sesi ↑, id ↑. */
export function playerMatches(matches: MatchRecord[], memberId: MemberId, kind: MatchKind | null = "doubles"): MatchRecord[] {
  return matches
    .filter(
      (m) =>
        m.status === "completed" &&
        m.winner !== null &&
        (kind === null || m.kind === kind) &&
        (m.players.A.includes(memberId) || m.players.B.includes(memberId)),
    )
    .sort((x, y) => x.sessionDate.getTime() - y.sessionDate.getTime() || x.order - y.order || compareId(x.id, y.id));
}

export function sideOf(match: MatchRecord, memberId: MemberId): Side | null {
  return match.players.A.includes(memberId) ? "A" : match.players.B.includes(memberId) ? "B" : null;
}

const outcome = (match: MatchRecord, memberId: MemberId): Outcome => (match.winner === sideOf(match, memberId) ? "W" : "L");

/** `n` hasil terakhir, terbaru dulu (L6 "form 5 match terakhir"). */
export function recentForm(matches: MatchRecord[], memberId: MemberId, n = 5, kind: MatchKind | null = "doubles"): Outcome[] {
  return playerMatches(matches, memberId, kind)
    .slice(-n)
    .reverse()
    .map((m) => outcome(m, memberId));
}

export interface Streak {
  result: Outcome;
  length: number;
}

/** Rentetan menang/kalah yang sedang berjalan (terhitung dari match terbaru); null bila belum main. */
export function currentStreak(matches: MatchRecord[], memberId: MemberId, kind: MatchKind | null = "doubles"): Streak | null {
  const results = playerMatches(matches, memberId, kind).map((m) => outcome(m, memberId));
  const last = results.at(-1);
  if (!last) return null;
  let length = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) length++;
  return { result: last, length };
}

/** Rentetan menang terpanjang sepanjang periode. */
export function longestWinStreak(matches: MatchRecord[], memberId: MemberId, kind: MatchKind | null = "doubles"): number {
  let best = 0;
  let run = 0;
  for (const m of playerMatches(matches, memberId, kind)) {
    run = outcome(m, memberId) === "W" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export interface HeadToHead {
  played: number;
  /** kemenangan a atas b */
  wonA: number;
  wonB: number;
  /** Σ poin rally sisi a / sisi b di match itu */
  pointsA: number;
  pointsB: number;
  /** terbaru dulu */
  matches: MatchRecord[];
}

/** Rekor a vs b: hanya match di mana keduanya berada di sisi berlawanan (L7). */
export function headToHead(matches: MatchRecord[], a: MemberId, b: MemberId, kind: MatchKind | null = "doubles"): HeadToHead {
  const meetings = playerMatches(matches, a, kind).filter((m) => {
    const sa = sideOf(m, a);
    const sb = sideOf(m, b);
    return sb !== null && sa !== sb;
  });
  const result: HeadToHead = { played: meetings.length, wonA: 0, wonB: 0, pointsA: 0, pointsB: 0, matches: [...meetings].reverse() };
  for (const m of meetings) {
    const sa = sideOf(m, a)!;
    const totals = rallyTotals(m);
    if (m.winner === sa) result.wonA++;
    else result.wonB++;
    result.pointsA += totals[sa];
    result.pointsB += totals[sa === "A" ? "B" : "A"];
  }
  return result;
}

/** Lawan yang paling sering dihadapi (terbanyak main melawan; seri → id ↑). */
export function frequentOpponents(matches: MatchRecord[], memberId: MemberId, kind: MatchKind | null = "doubles"): { memberId: MemberId; played: number }[] {
  const counts = new Map<MemberId, number>();
  for (const m of playerMatches(matches, memberId, kind)) {
    const side = sideOf(m, memberId)!;
    for (const id of m.players[side === "A" ? "B" : "A"]) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, played]) => ({ memberId: id, played }))
    .sort((x, y) => y.played - x.played || compareId(x.memberId, y.memberId));
}
