import "server-only";
import {
  kikoMood,
  levelProgress,
  memberXp,
  resolveOutfit,
  weeklyStreak,
  type KikoMood,
  type KikoOutfit,
  type LevelProgress,
  type XpBreakdown,
} from "@/lib/core/mascot";
import type { MatchRecord } from "@/lib/core/types";
import { HttpError } from "@/lib/http-error";
import { serviceClient } from "./supabase";

export interface KikoState {
  progress: LevelProgress;
  xp: XpBreakdown;
  /** minggu berturut-turut main */
  streak: number;
  mood: KikoMood;
  outfit: KikoOutfit;
  /** true = kostum pilihan sendiri; false = otomatis sesuai level */
  custom: boolean;
}

/** Tanggal sesi grup yang sudah dimulai dan dihadiri anggota. */
async function attendedSessionDates(groupId: string, memberId: string): Promise<Date[]> {
  const { data, error } = await serviceClient()
    .from("attendees")
    .select("sessions!inner(group_id, starts_at, status)")
    .eq("member_id", memberId)
    .eq("present", true)
    .eq("sessions.group_id", groupId)
    .in("sessions.status", ["running", "finished"]);
  if (error) throw error;
  return data.map((a) => new Date(a.sessions.starts_at));
}

/** Kiko anggota: semua angka diturunkan dari match selesai grup & kehadiran. Panggil hanya setelah requireMember. */
export async function loadKiko(groupId: string, memberId: string, matches: MatchRecord[], now: Date): Promise<KikoState> {
  const [dates, { data, error }] = await Promise.all([
    attendedSessionDates(groupId, memberId),
    serviceClient().from("members").select("kiko").eq("group_id", groupId).eq("id", memberId).maybeSingle(),
  ]);
  if (error) throw error;
  const xp = memberXp(matches, memberId, dates.length);
  const progress = levelProgress(xp.xp);
  const streak = weeklyStreak(dates, now);
  const saved = (data?.kiko ?? null) as Record<string, unknown> | null;
  return { progress, xp, streak, mood: kikoMood(streak), outfit: resolveOutfit(saved, progress.level), custom: saved !== null };
}

/** Simpan kostum Kiko milik sendiri; pilihan yang belum terbuka di level sekarang ditolak. */
export async function saveKikoOutfit(groupId: string, memberId: string, outfit: KikoOutfit | null, state: KikoState): Promise<void> {
  if (outfit) {
    const shown = resolveOutfit(outfit, state.progress.level);
    const locked = (Object.keys(outfit) as (keyof KikoOutfit)[]).filter((part) => shown[part] !== outfit[part]);
    if (locked.length > 0) throw new HttpError(422, "Ada pilihan kostum yang belum terbuka di level Kiko sekarang.");
  }
  const { error } = await serviceClient().from("members").update({ kiko: outfit ? { ...outfit } : null }).eq("group_id", groupId).eq("id", memberId);
  if (error) throw error;
}
