// Tampilan leaderboard (PRD L1–L5, L10, L11 ganda). Merangkai `standings`/`pairStats`;
// tidak ada aturan klasemen baru di sini.
import {
  bestPartner,
  inPeriod,
  jakartaMonth,
  pairStats,
  standings,
  type PairStat,
  type PartnerStat,
  type Period,
  type ScoringConfig,
  type StandingRow,
} from "./standings";
import type { MatchKind, MatchRecord, MemberId } from "./types";

export type PeriodKey = "sesi" | "bulan" | "musim" | "semua";
export const PERIOD_KEYS: readonly PeriodKey[] = ["sesi", "bulan", "musim", "semua"];
export const DEFAULT_PERIOD: PeriodKey = "bulan";

export interface MonthRef {
  year: number;
  month: number;
}

/** "2026-10" ↔ {year: 2026, month: 10} */
export function monthKey({ year, month }: MonthRef): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(value: string): MonthRef | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

/** Bulan (WIB) yang punya match di `matches`, terbaru dulu; bulan `current` selalu ada. */
export function monthsWithMatches(matches: MatchRecord[], current: MonthRef): MonthRef[] {
  const keys = new Set([monthKey(current)]);
  for (const m of matches) keys.add(monthKey(jakartaMonth(m.sessionDate)));
  return [...keys].sort().reverse().map((k) => parseMonthKey(k)!);
}

export interface PeriodChoice {
  key: PeriodKey;
  /** id sesi pilihan; null = tidak ada sesi untuk ditampilkan */
  sessionId: string | null;
  month: MonthRef;
  seasonId: string | null;
}

/** Pilihan pengguna → `Period` untuk `standings`; null bila periode itu belum punya data acuan. */
export function toPeriod(choice: PeriodChoice): Period | null {
  switch (choice.key) {
    case "sesi":
      return choice.sessionId ? { kind: "session", sessionId: choice.sessionId } : null;
    case "bulan":
      return { kind: "month", ...choice.month };
    case "musim":
      return choice.seasonId ? { kind: "season", seasonId: choice.seasonId } : null;
    case "semua":
      return { kind: "all" };
  }
}

/**
 * Minimal main bareng agar pasangan masuk daftar "pasangan terbaik".
 * Sesi = 2 (sama dengan recap); periode panjang = 3 (default `bestPartner`, ALGORITHMS §3).
 */
export function pairMinTogether(period: Period): number {
  return period.kind === "session" ? 2 : 3;
}

export interface Leaderboard {
  /** baris ranked, urut peringkat */
  ranked: StandingRow[];
  /** played < minMatches; tampil di bawah tanpa peringkat */
  unranked: StandingRow[];
  /** maksimal 3 baris ranked teratas */
  podium: StandingRow[];
  pairs: PairStat[];
  pairMin: number;
  /** partner terbaik `me` di periode ini (null bila belum memenuhi `pairMin`) */
  myBestPartner: PartnerStat | null;
  matchCount: number;
}

export function buildLeaderboard(
  matches: MatchRecord[],
  scoring: Partial<ScoringConfig>,
  period: Period,
  options: { kind?: MatchKind; me?: MemberId | null } = {},
): Leaderboard {
  const { kind = "doubles", me = null } = options;
  const counted = matches.filter(
    (m) => m.kind === kind && m.status === "completed" && m.winner !== null && inPeriod(m, period),
  );
  // Klasemen sesi mengabaikan minMatches, sama dengan juara sesi di recap (L8 untuk periode panjang).
  const config = period.kind === "session" ? { ...scoring, minMatches: 0 } : scoring;
  const rows = standings(counted, config, period);
  const ranked = rows.filter((r) => r.ranked);
  const pairMin = pairMinTogether(period);
  const allPairs = pairStats(counted);
  return {
    ranked,
    unranked: rows.filter((r) => !r.ranked),
    podium: ranked.slice(0, 3),
    pairs: allPairs.filter((p) => p.played >= pairMin),
    pairMin,
    myBestPartner: me ? bestPartner(allPairs, me, pairMin) : null,
    matchCount: counted.length,
  };
}

export interface SessionRef {
  id: string;
  startsAt: Date;
  status: "planned" | "running" | "finished";
}

/**
 * Sesi untuk filter "Sesi ini": sesi yang sedang berlangsung (terbaru), selain itu
 * sesi terbaru yang punya match di `matches`. Null bila tidak ada keduanya.
 */
export function defaultSessionId(sessions: SessionRef[], matches: MatchRecord[]): string | null {
  const newest = (list: SessionRef[]) =>
    [...list].sort((x, y) => y.startsAt.getTime() - x.startsAt.getTime())[0]?.id ?? null;
  const running = sessions.filter((s) => s.status === "running");
  if (running.length > 0) return newest(running);
  const withMatches = new Set(matches.map((m) => m.sessionId));
  return newest(sessions.filter((s) => withMatches.has(s.id)));
}

export interface SeasonRef {
  id: string;
  startsOn: string;
  closedAt: string | null;
}

/** Musim aktif (belum ditutup, mulai paling akhir), selain itu musim terbaru. */
export function defaultSeasonId(seasons: SeasonRef[]): string | null {
  const byStart = [...seasons].sort((x, y) => (x.startsOn < y.startsOn ? 1 : x.startsOn > y.startsOn ? -1 : 0));
  return (byStart.find((s) => s.closedAt === null) ?? byStart[0])?.id ?? null;
}

/** Juara periode: semua baris ranked peringkat 1 (seri → lebih dari satu). Dipakai juara musim (L9). */
export function champions(board: Leaderboard): StandingRow[] {
  return board.ranked.filter((r) => r.rank === 1);
}
