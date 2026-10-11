import "server-only";
import { HttpError } from "@/lib/http-error";
import type { SeasonInput } from "@/lib/validation";
import { serviceClient } from "./supabase";

export interface Season {
  id: string;
  name: string;
  /** "YYYY-MM-DD" (WIB) */
  startsOn: string;
  endsOn: string | null;
  closedAt: string | null;
}

const UNIQUE_VIOLATION = "23505";

/** Musim grup, terbaru dulu. Panggil hanya setelah requireMember. */
export async function listSeasons(groupId: string): Promise<Season[]> {
  const { data, error } = await serviceClient()
    .from("seasons")
    .select("id, name, starts_on, ends_on, closed_at")
    .eq("group_id", groupId)
    .order("starts_on", { ascending: false });
  if (error) throw error;
  return data.map((s) => ({ id: s.id, name: s.name, startsOn: s.starts_on, endsOn: s.ends_on, closedAt: s.closed_at }));
}

/** sessions.season_id mengikuti rentang tanggal musim (dipanggil setelah musim/sesi berubah). */
export async function assignSeasons(groupId: string): Promise<void> {
  const { error } = await serviceClient().rpc("assign_seasons", { p_group: groupId });
  if (error) throw error;
}

/** Buat musim baru (admin). Hanya satu musim berjalan per grup. */
export async function createSeason(groupId: string, input: SeasonInput): Promise<string> {
  const { data, error } = await serviceClient()
    .from("seasons")
    .insert({ group_id: groupId, name: input.name, starts_on: input.startsOn, ends_on: input.endsOn })
    .select("id")
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, "Masih ada musim yang berjalan. Tutup musim itu dulu.");
  if (error) throw error;
  await assignSeasons(groupId);
  return data.id;
}

/** Tutup (arsipkan) musim: tanggal akhir = `today` bila belum diisi. */
export async function closeSeason(groupId: string, seasonId: string, today: string, now: Date): Promise<void> {
  const db = serviceClient();
  const { data: season, error: findError } = await db
    .from("seasons")
    .select("starts_on, ends_on, closed_at")
    .eq("id", seasonId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (findError) throw findError;
  if (!season) throw new HttpError(404, "Musim tidak ditemukan.");
  if (season.closed_at) throw new HttpError(409, "Musim ini sudah ditutup.");
  const endsOn = season.ends_on ?? (today < season.starts_on ? season.starts_on : today);
  const { error } = await db.from("seasons").update({ closed_at: now.toISOString(), ends_on: endsOn }).eq("id", seasonId).is("closed_at", null);
  if (error) throw error;
  await assignSeasons(groupId);
}
