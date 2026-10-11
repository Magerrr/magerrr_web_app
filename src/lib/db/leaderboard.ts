import "server-only";
import type { SeasonRef, SessionRef } from "@/lib/core/leaderboard";
import type { MatchRecord } from "@/lib/core/types";
import { loadGroupMatches } from "./matches";
import { memberNames } from "./members";
import { serviceClient } from "./supabase";

export interface LeaderboardSession extends SessionRef {
  venue: string | null;
}

export interface LeaderboardSeason extends SeasonRef {
  name: string;
}

export interface LeaderboardSources {
  /** semua match selesai di grup (klasemen diturunkan dari sini setiap kali) */
  matches: MatchRecord[];
  /** termasuk anggota nonaktif: match lama tetap punya nama */
  names: Record<string, string>;
  /** sesi yang punya match selesai atau sedang berlangsung, terbaru dulu */
  sessions: LeaderboardSession[];
  seasons: LeaderboardSeason[];
}

/** Data mentah leaderboard grup. Panggil hanya setelah requireMember. */
export async function loadLeaderboardSources(groupId: string): Promise<LeaderboardSources> {
  const db = serviceClient();
  const [matches, names, sessions, seasons] = await Promise.all([
    loadGroupMatches(groupId),
    memberNames(groupId),
    db
      .from("sessions")
      .select("id, starts_at, status, venue")
      .eq("group_id", groupId)
      .neq("status", "planned")
      .order("starts_at", { ascending: false }),
    db.from("seasons").select("id, name, starts_on, closed_at").eq("group_id", groupId).order("starts_on", { ascending: false }),
  ]);
  if (sessions.error) throw sessions.error;
  if (seasons.error) throw seasons.error;

  const withMatches = new Set(matches.map((m) => m.sessionId));
  return {
    matches,
    names,
    sessions: sessions.data
      .filter((s) => s.status === "running" || withMatches.has(s.id))
      .map((s) => ({ id: s.id, startsAt: new Date(s.starts_at), status: s.status, venue: s.venue })),
    seasons: seasons.data.map((s) => ({ id: s.id, name: s.name, startsOn: s.starts_on, closedAt: s.closed_at })),
  };
}
