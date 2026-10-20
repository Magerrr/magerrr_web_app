import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http-error";
import type { Membership } from "./authz";
import { isGroupAdmin } from "./authz";
import { MEDIA_BUCKET, readImageFile, readMedia } from "./group-media";
import { serviceClient } from "./supabase";

/** Foto momen setelah diperkecil di Perangkat (1600px JPEG ± 300 KB); server tetap membatasi. */
export const MAX_MOMENT_BYTES = 3 * 1024 * 1024;
/** Batas unggah per anggota agar kuota Storage grup tidak habis oleh satu orang. */
const DAILY_LIMIT = 20;
const PAGE_SIZE = 60;

export interface Moment {
  id: string;
  url: string;
  caption: string | null;
  memberId: string;
  memberName: string;
  sessionId: string | null;
  createdAt: string;
}

export const momentUrl = (groupId: string, momentId: string) => `/api/groups/${groupId}/moments/${momentId}/image`;

/** Momen grup terbaru dulu (maks. 60, atau `limit`). Panggil hanya setelah requireMember. */
export async function listMoments(groupId: string, limit = PAGE_SIZE): Promise<Moment[]> {
  const { data, error } = await serviceClient()
    .from("group_moments")
    .select("id, caption, member_id, session_id, created_at, members!inner(display_name)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, PAGE_SIZE));
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    url: momentUrl(groupId, m.id),
    caption: m.caption,
    memberId: m.member_id,
    memberName: m.members.display_name,
    sessionId: m.session_id,
    createdAt: m.created_at,
  }));
}

/** Unggah momen (anggota mana pun). `sessionId` opsional, harus sesi grup ini. */
export async function addMoment(
  groupId: string,
  memberId: string,
  file: File,
  input: { caption: string | null; sessionId: string | null },
): Promise<string> {
  const db = serviceClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: countError } = await db
    .from("group_moments")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= DAILY_LIMIT) throw new HttpError(429, `Maksimal ${DAILY_LIMIT} foto per hari. Coba lagi besok.`);

  if (input.sessionId) {
    const { data: session, error } = await db.from("sessions").select("id").eq("id", input.sessionId).eq("group_id", groupId).maybeSingle();
    if (error) throw error;
    if (!session) throw new HttpError(422, "Sesi tidak ditemukan di grup ini.");
  }

  const { bytes, type, ext } = await readImageFile(file, MAX_MOMENT_BYTES, "Foto");
  const path = `${groupId}/moments/${randomUUID()}.${ext}`;
  const upload = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) throw upload.error;
  const { data, error } = await db
    .from("group_moments")
    .insert({ group_id: groupId, member_id: memberId, session_id: input.sessionId, image_path: path, caption: input.caption })
    .select("id")
    .single();
  if (error) {
    await db.storage.from(MEDIA_BUCKET).remove([path]);
    throw error;
  }
  return data.id;
}

/** Hapus momen: pengunggahnya sendiri atau admin grup. */
export async function deleteMoment(groupId: string, actor: Membership, momentId: string): Promise<void> {
  const db = serviceClient();
  const { data, error } = await db.from("group_moments").select("member_id, image_path").eq("id", momentId).eq("group_id", groupId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Foto tidak ditemukan.");
  if (data.member_id !== actor.member.id && !isGroupAdmin(actor)) throw new HttpError(403, "Kamu hanya bisa menghapus fotomu sendiri.");
  const { error: deleteError } = await db.from("group_moments").delete().eq("id", momentId);
  if (deleteError) throw deleteError;
  await db.storage.from(MEDIA_BUCKET).remove([data.image_path]);
}

/** Berkas foto momen milik grup, atau null. Akses diperiksa pemanggil. */
export async function readMomentImage(groupId: string, momentId: string): Promise<Blob | null> {
  const { data, error } = await serviceClient().from("group_moments").select("image_path").eq("id", momentId).eq("group_id", groupId).maybeSingle();
  if (error) throw error;
  return data ? readMedia(data.image_path) : null;
}
