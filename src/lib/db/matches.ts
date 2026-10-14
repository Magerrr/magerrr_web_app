import "server-only";
import type { GameRules } from "@/lib/core/rules";
import type { TournamentLink } from "@/lib/core/tournament";
import type { GameScore, MatchRecord, Side, Teams } from "@/lib/core/types";
import { serviceClient } from "./supabase";

/** Match di dalam sesi beserta aturan yang berlaku untuknya (snapshot saat match dibuat). */
export interface SessionMatch extends MatchRecord {
  courtNo: number | null;
  rules: GameRules;
  gamesMax: 1 | 3 | 5;
  /** waktu match dibuat = mulai main (input skor manual: ≈ selesai) */
  startedAt: Date;
  completedAt: Date | null;
  /** pihak yang servis pada match berjalan (ALGORITHMS §1e); null = belum diketahui */
  serving: Side | null;
  /** tautan ke turnamen (slot bagan / pasangan seed); null = match biasa */
  tournament: (TournamentLink & { id: string }) | null;
}

type PlayerRow = { side: string; member_id: string };
type GameRow = { game_no: number; score_a: number; score_b: number };

function teams(rows: PlayerRow[]): Teams {
  return {
    A: rows.filter((p) => p.side === "A").map((p) => p.member_id),
    B: rows.filter((p) => p.side === "B").map((p) => p.member_id),
  };
}

function games(rows: GameRow[]): GameScore[] {
  return [...rows].sort((x, y) => x.game_no - y.game_no).map((g) => ({ a: g.score_a, b: g.score_b }));
}

const PAGE = 1000; // batas baris default PostgREST

/** Semua match sesi (termasuk running & void), urut seq. */
export async function loadSessionMatches(
  session: { id: string; startsAt: Date; rules: GameRules | null; matchGames: 1 | 3 | 5 | null },
  fallback: { rules: GameRules; matchGames: 1 | 3 | 5 },
): Promise<SessionMatch[]> {
  const { data, error } = await serviceClient()
    .from("matches")
    .select(
      "id, seq, kind, court_no, status, winner, serving, rules, games_max, created_at, completed_at, tournament_id, bracket_round, bracket_slot, entry_a, entry_b, match_players(side, member_id), games(game_no, score_a, score_b)",
    )
    .eq("session_id", session.id)
    .order("seq");
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    sessionId: session.id,
    sessionDate: session.startsAt,
    order: m.seq,
    kind: m.kind,
    status: m.status,
    players: teams(m.match_players),
    games: games(m.games),
    winner: m.winner as Side | null,
    courtNo: m.court_no,
    serving: m.serving as Side | null,
    rules: (m.rules as unknown as GameRules | null) ?? session.rules ?? fallback.rules,
    gamesMax: (m.games_max ?? session.matchGames ?? fallback.matchGames) as 1 | 3 | 5,
    startedAt: new Date(m.created_at),
    completedAt: m.completed_at === null ? null : new Date(m.completed_at),
    tournament:
      m.tournament_id === null
        ? null
        : m.bracket_round !== null && m.bracket_slot !== null
          ? { id: m.tournament_id, stage: "knockout", round: m.bracket_round, slot: m.bracket_slot }
          : m.entry_a !== null && m.entry_b !== null
            ? { id: m.tournament_id, stage: "pool", a: m.entry_a, b: m.entry_b }
            : null,
  }));
}

/** Semua match selesai di grup (untuk rating, riwayat pasangan, klasemen). */
export async function loadGroupMatches(groupId: string): Promise<MatchRecord[]> {
  const result: MatchRecord[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await serviceClient()
      .from("matches")
      .select("id, seq, kind, status, winner, session_id, sessions!inner(group_id, starts_at, season_id), match_players(side, member_id), games(game_no, score_a, score_b)")
      .eq("sessions.group_id", groupId)
      .eq("status", "completed")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const m of data) {
      result.push({
        id: m.id,
        sessionId: m.session_id,
        seasonId: m.sessions.season_id,
        sessionDate: new Date(m.sessions.starts_at),
        order: m.seq,
        kind: m.kind,
        status: m.status,
        players: teams(m.match_players),
        games: games(m.games),
        winner: m.winner as Side | null,
      });
    }
    if (data.length < PAGE) return result;
  }
}
