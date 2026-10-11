// Recap bulan / musim (docs/ALGORITHMS.md §7). PRD: R6. Diturunkan dari match, tidak disimpan.
import { buildLeaderboard, champions, type MonthRef } from "./leaderboard";
import { leaders, matchHighlights, type MatchHighlights } from "./recap";
import { inPeriod, type PairStat, type Period, type ScoringConfig, type StandingRow } from "./standings";
import { compareId, type MatchRecord, type MemberId } from "./types";

export interface RankChange {
  memberId: MemberId;
  rank: number;
  /** peringkat di periode pembanding; null bila tidak ranked di sana */
  previousRank: number | null;
  /** previousRank − rank; positif = naik */
  change: number | null;
}

export interface PeriodRecap extends MatchHighlights {
  totals: { matches: number; games: number; sessions: number; players: number };
  champion: StandingRow[] | null;
  podium: StandingRow[];
  bestPair: PairStat | null;
  mostSessions: { sessions: number; memberIds: MemberId[] } | null;
  rankChanges: RankChange[];
}

export function buildPeriodRecap(
  matches: MatchRecord[],
  scoring: Partial<ScoringConfig>,
  period: Period,
  previous: Period | null,
): PeriodRecap {
  const board = buildLeaderboard(matches, scoring, period);
  const played = matches
    .filter((m) => m.kind === "doubles" && m.status === "completed" && m.winner !== null && inPeriod(m, period))
    .sort((x, y) => x.sessionDate.getTime() - y.sessionDate.getTime() || x.order - y.order || compareId(x.id, y.id));

  const sessionsOf = new Map<MemberId, Set<string>>();
  for (const m of played) {
    for (const id of [...m.players.A, ...m.players.B]) sessionsOf.set(id, (sessionsOf.get(id) ?? new Set()).add(m.sessionId));
  }
  const sessionLeaders = leaders(new Map([...sessionsOf].map(([id, set]) => [id, set.size])));

  const before = previous ? new Map(buildLeaderboard(matches, scoring, previous).ranked.map((r) => [r.memberId, r.rank!])) : new Map<MemberId, number>();
  const champion = champions(board);

  return {
    totals: {
      matches: played.length,
      games: played.reduce((sum, m) => sum + m.games.length, 0),
      sessions: new Set(played.map((m) => m.sessionId)).size,
      players: sessionsOf.size,
    },
    champion: champion.length > 0 ? champion : null,
    podium: board.podium,
    bestPair: board.pairs[0] ?? null,
    ...matchHighlights(played),
    mostSessions: sessionLeaders && { sessions: sessionLeaders.value, memberIds: sessionLeaders.memberIds },
    rankChanges: board.ranked.map((r) => {
      const previousRank = before.get(r.memberId) ?? null;
      return { memberId: r.memberId, rank: r.rank!, previousRank, change: previousRank === null ? null : previousRank - r.rank! };
    }),
  };
}

export function previousMonth({ year, month }: MonthRef): MonthRef {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** Musim yang mulai tepat sebelum `seasonId` menurut `startsOn`; null bila musim pertama / tidak ada. */
export function previousSeasonId(seasons: { id: string; startsOn: string }[], seasonId: string): string | null {
  const ordered = [...seasons].sort((x, y) => (x.startsOn < y.startsOn ? -1 : x.startsOn > y.startsOn ? 1 : compareId(x.id, y.id)));
  const i = ordered.findIndex((s) => s.id === seasonId);
  return i > 0 ? ordered[i - 1].id : null;
}
