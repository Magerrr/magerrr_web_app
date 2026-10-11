// Sorotan recap sesi (docs/ALGORITHMS.md §6). PRD: R1–R3.
// Data kosong → field terkait null (UI menyembunyikan kartunya), bukan error.
import { splitBill, type Expense } from "./split";
import { pairStats, standings, type PairStat, type ScoringConfig, type StandingRow } from "./standings";
import { compareId, type MatchRecord, type MemberId, type Rupiah, type Side, type Teams } from "./types";

export interface RecapSession {
  id: string;
  scoring?: Partial<ScoringConfig>;
  participants: MemberId[];
  hostId: MemberId;
  roundTo: number;
  settlements?: { status: "paid" | "unpaid" }[];
}

export interface GameHighlight {
  matchId: string;
  /** 1-based */
  gameNo: number;
  a: number;
  b: number;
  margin: number;
  winner: Side;
  players: Teams;
}

export interface Recap {
  /** peringkat 1 klasemen sesi; lebih dari satu bila seri */
  champion: StandingRow[] | null;
  bestPair: PairStat | null;
  tightestGame: GameHighlight | null;
  biggestWin: GameHighlight | null;
  longestWinStreak: { length: number; memberIds: MemberId[] } | null;
  mostPlayed: { played: number; memberIds: MemberId[] } | null;
  totals: {
    matches: number;
    games: number;
    cost: Rupiah;
    /** yang harus ditransfer tiap debitur setelah pembulatan; null bila tanpa biaya */
    perPerson: Record<MemberId, Rupiah> | null;
    paid: number;
    settlements: number;
  };
}

/** Pemain dengan nilai maksimum (seri → semua, urut id); null bila maksimum <= 0. */
export function leaders(counts: Map<MemberId, number>): { value: number; memberIds: MemberId[] } | null {
  const value = Math.max(0, ...counts.values());
  if (value === 0) return null;
  const memberIds = [...counts].filter(([, v]) => v === value).map(([id]) => id).sort(compareId);
  return { value, memberIds };
}

export type MatchHighlights = Pick<Recap, "tightestGame" | "biggestWin" | "longestWinStreak" | "mostPlayed">;

/**
 * Sorotan dari match selesai yang sudah urut kronologis (§6): rally terketat & kemenangan terbesar
 * (seri → yang terbaru), win streak terpanjang, paling banyak main. Dipakai recap sesi & periode (§7).
 */
export function matchHighlights(played: MatchRecord[]): MatchHighlights {
  // Urutan kronologis game: urutan match lalu nomor game; seri → yang terbaru.
  const games: GameHighlight[] = played.flatMap((m) =>
    m.games
      .map((g, i) => ({
        matchId: m.id,
        gameNo: i + 1,
        a: g.a,
        b: g.b,
        margin: Math.abs(g.a - g.b),
        winner: (g.a > g.b ? "A" : "B") as Side,
        players: m.players,
      }))
      .filter((g) => g.margin > 0),
  );
  const pickLatest = (better: (x: GameHighlight, y: GameHighlight) => boolean) =>
    games.reduce<GameHighlight | null>((best, g) => (!best || !better(best, g) ? g : best), null);

  const streak = new Map<MemberId, number>();
  const longest = new Map<MemberId, number>();
  const count = new Map<MemberId, number>();
  for (const m of played) {
    for (const side of ["A", "B"] as const) {
      for (const id of m.players[side]) {
        count.set(id, (count.get(id) ?? 0) + 1);
        const current = m.winner === side ? (streak.get(id) ?? 0) + 1 : 0;
        streak.set(id, current);
        longest.set(id, Math.max(longest.get(id) ?? 0, current));
      }
    }
  }
  const streakLeaders = leaders(longest);
  const playLeaders = leaders(count);
  return {
    tightestGame: pickLatest((best, g) => best.margin < g.margin),
    biggestWin: pickLatest((best, g) => best.margin > g.margin),
    longestWinStreak: streakLeaders && { length: streakLeaders.value, memberIds: streakLeaders.memberIds },
    mostPlayed: playLeaders && { played: playLeaders.value, memberIds: playLeaders.memberIds },
  };
}

export function buildRecap(session: RecapSession, matches: MatchRecord[], expenses: Expense[]): Recap {
  const played = matches
    .filter((m) => m.sessionId === session.id && m.status === "completed" && m.winner !== null)
    .sort((x, y) => x.order - y.order);

  // Juara sesi memakai poin grup tanpa minMatches (L8 untuk klasemen jangka panjang).
  const table = standings(played, { ...session.scoring, minMatches: 0 }, { kind: "session", sessionId: session.id });
  const champion = table.filter((row) => row.rank === 1);

  // pairStats sudah urut win rate ↓, selisih ↓, id ↑
  const bestPair = pairStats(played).find((p) => p.played >= 2);

  const { tightestGame, biggestWin, longestWinStreak, mostPlayed } = matchHighlights(played);

  const bill =
    expenses.length > 0
      ? splitBill({
          participants: session.participants,
          expenses,
          hostId: session.hostId,
          roundTo: session.roundTo,
        })
      : null;
  const settlements = session.settlements ?? [];

  return {
    champion: champion.length > 0 ? champion : null,
    bestPair: bestPair ?? null,
    tightestGame,
    biggestWin,
    longestWinStreak,
    mostPlayed,
    totals: {
      matches: played.length,
      games: played.reduce((s, m) => s + m.games.length, 0),
      cost: bill?.total ?? 0,
      perPerson: bill && Object.fromEntries([...bill.rounded].filter(([, v]) => v > 0)),
      paid: settlements.filter((s) => s.status === "paid").length,
      settlements: settlements.length,
    },
  };
}
