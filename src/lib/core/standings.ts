// Klasemen & statistik pasangan (docs/ALGORITHMS.md §2–§3). PRD: L1–L5, L10.
// Selalu diturunkan dari data match; tidak ada angka klasemen yang disimpan.
import { compareId, otherSide, type MatchRecord, type MemberId, type Side } from "./types";

export interface ScoringConfig {
  winPoints: number;
  lossPoints: number;
  /** kekalahan tipis: |Σ poin rally A − Σ poin rally B| pada match itu <= maxMargin */
  lossBonus?: { maxMargin: number; points: number } | null;
  minMatches: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  winPoints: 3,
  lossPoints: 0,
  lossBonus: null,
  minMatches: 0,
};

export type Period =
  | { kind: "session"; sessionId: string }
  | { kind: "month"; year: number; month: number }
  | { kind: "season"; seasonId: string }
  | { kind: "all" };

export interface StandingRow {
  memberId: MemberId;
  /** null bila ranked = false */
  rank: number | null;
  ranked: boolean;
  played: number;
  won: number;
  lost: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  tablePoints: number;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 tanpa DST

/** Bulan kalender Asia/Jakarta (month 1–12) dari sebuah waktu. */
export function jakartaMonth(date: Date): { year: number; month: number } {
  const local = new Date(date.getTime() + WIB_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1 };
}

export function inPeriod(match: MatchRecord, period: Period): boolean {
  switch (period.kind) {
    case "session":
      return match.sessionId === period.sessionId;
    case "season":
      return match.seasonId === period.seasonId;
    case "month": {
      const { year, month } = jakartaMonth(match.sessionDate);
      return year === period.year && month === period.month;
    }
    case "all":
      return true;
  }
}

/** Σ poin rally sisi A dan B di semua game match. */
export function rallyTotals(match: MatchRecord): { A: number; B: number } {
  return match.games.reduce((t, g) => ({ A: t.A + g.a, B: t.B + g.b }), { A: 0, B: 0 });
}

function isCounted(match: MatchRecord): match is MatchRecord & { winner: Side } {
  return match.status === "completed" && match.winner !== null;
}

const winRate = (won: number, played: number) => (played === 0 ? 0 : won / played);

/** Urutan kriteria L5; mengembalikan 0 bila keempatnya identik. */
function compareStanding(x: StandingRow, y: StandingRow): number {
  return (
    y.tablePoints - x.tablePoints ||
    y.winRate - x.winRate ||
    y.pointDiff - x.pointDiff ||
    y.played - x.played
  );
}

export function standings(
  matches: MatchRecord[],
  config: Partial<ScoringConfig> = {},
  period: Period = { kind: "all" },
): StandingRow[] {
  const { winPoints, lossPoints, lossBonus, minMatches } = { ...DEFAULT_SCORING, ...config };
  const rows = new Map<MemberId, StandingRow & { narrowLosses: number }>();

  for (const match of matches) {
    if (!isCounted(match) || !inPeriod(match, period)) continue;
    const totals = rallyTotals(match);
    const margin = Math.abs(totals.A - totals.B);
    for (const side of ["A", "B"] as const) {
      const other = otherSide(side);
      for (const memberId of match.players[side]) {
        const row = rows.get(memberId) ?? {
          memberId,
          rank: null,
          ranked: false,
          played: 0,
          won: 0,
          lost: 0,
          winRate: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointDiff: 0,
          tablePoints: 0,
          narrowLosses: 0,
        };
        row.played++;
        if (match.winner === side) row.won++;
        else {
          row.lost++;
          if (lossBonus && margin <= lossBonus.maxMargin) row.narrowLosses++;
        }
        row.pointsFor += totals[side];
        row.pointsAgainst += totals[other];
        rows.set(memberId, row);
      }
    }
  }

  const result: StandingRow[] = [...rows.values()].map(({ narrowLosses, ...row }) => ({
    ...row,
    ranked: row.played >= minMatches,
    winRate: winRate(row.won, row.played),
    pointDiff: row.pointsFor - row.pointsAgainst,
    tablePoints: row.won * winPoints + row.lost * lossPoints + narrowLosses * (lossBonus?.points ?? 0),
  }));

  result.sort(
    (x, y) =>
      Number(y.ranked) - Number(x.ranked) || compareStanding(x, y) || compareId(x.memberId, y.memberId),
  );

  result.forEach((row, i) => {
    if (!row.ranked) return;
    const prev = result[i - 1];
    row.rank = prev?.ranked && compareStanding(prev, row) === 0 ? prev.rank : i + 1;
  });
  return result;
}

export interface PairStat {
  /** terurut (minId, maxId) */
  members: [MemberId, MemberId];
  played: number;
  won: number;
  lost: number;
  winRate: number;
  pointDiff: number;
}

/** Statistik pasangan ganda; tunggal tidak dihitung. Urut win rate ↓, selisih ↓, id ↑. */
export function pairStats(matches: MatchRecord[]): PairStat[] {
  const pairs = new Map<string, PairStat>();
  for (const match of matches) {
    if (!isCounted(match) || match.kind !== "doubles") continue;
    const totals = rallyTotals(match);
    for (const side of ["A", "B"] as const) {
      const team = match.players[side];
      if (team.length !== 2) continue;
      const members = [...team].sort(compareId) as [MemberId, MemberId];
      const key = members.join("\u0000");
      const stat = pairs.get(key) ?? { members, played: 0, won: 0, lost: 0, winRate: 0, pointDiff: 0 };
      stat.played++;
      if (match.winner === side) stat.won++;
      else stat.lost++;
      stat.pointDiff += totals[side] - totals[otherSide(side)];
      stat.winRate = winRate(stat.won, stat.played);
      pairs.set(key, stat);
    }
  }
  return [...pairs.values()].sort(comparePairs);
}

function comparePairs(x: PairStat, y: PairStat): number {
  return (
    y.winRate - x.winRate ||
    y.pointDiff - x.pointDiff ||
    compareId(x.members[0], y.members[0]) ||
    compareId(x.members[1], y.members[1])
  );
}

export interface PartnerStat extends Omit<PairStat, "members"> {
  partnerId: MemberId;
}

/** Semua partner `memberId` tanpa ambang (L10): urut main ↓, win rate ↓, selisih ↓, id ↑. */
export function partnersOf(pairs: PairStat[], memberId: MemberId): PartnerStat[] {
  return pairs
    .filter((p) => p.members.includes(memberId))
    .map(({ members, ...stat }) => ({ ...stat, partnerId: members[0] === memberId ? members[1] : members[0] }))
    .sort(
      (x, y) =>
        y.played - x.played || y.winRate - x.winRate || y.pointDiff - x.pointDiff || compareId(x.partnerId, y.partnerId),
    );
}

/** Partner dengan win rate tertinggi dari pasangan yang main bareng >= minTogether. */
export function bestPartner(
  pairs: PairStat[],
  memberId: MemberId,
  minTogether = 3,
): PartnerStat | null {
  const candidates: PartnerStat[] = pairs
    .filter((p) => p.played >= minTogether && p.members.includes(memberId))
    .map(({ members, ...stat }) => ({
      ...stat,
      partnerId: members[0] === memberId ? members[1] : members[0],
    }));
  candidates.sort(
    (x, y) =>
      y.winRate - x.winRate || y.pointDiff - x.pointDiff || compareId(x.partnerId, y.partnerId),
  );
  return candidates[0] ?? null;
}
