import "server-only";
import { randomUUID } from "node:crypto";
import { readImageFile } from "./group-media";
import { serviceClient } from "./supabase";

/** Bucket privat foto profil akun (migrasi 0020); dibaca lewat route server. */
const AVATAR_BUCKET = "profile-media";
/** Batas setelah diperkecil di Perangkat (512px persegi); server tetap memeriksa. */
export const MAX_AVATAR_BYTES = 1024 * 1024;

export interface Account {
  id: string;
  displayName: string;
  /** URL foto lewat route server (berversi), atau null */
  avatarUrl: string | null;
}

const version = (path: string) => path.split("/").pop()?.split(".")[0] ?? "";

/** URL foto profil sendiri; `v` berubah tiap unggahan agar cache Perangkat tidak usang. */
export const ownAvatarUrl = (path: string | null) => (path ? `/api/profil/foto?v=${version(path)}` : null);

/** URL foto anggota grup yang terhubung ke akun (dibuka sesama anggota). */
export const memberAvatarUrl = (groupId: string, memberId: string, path: string | null) =>
  path ? `/api/groups/${groupId}/members/${memberId}/foto?v=${version(path)}` : null;

/** Profil akun pengguna login. Baris dibuat trigger saat mendaftar (migrasi 0002). */
export async function getAccount(userId: string): Promise<Account> {
  const { data, error } = await serviceClient().from("profiles").select("id, display_name, avatar_path").eq("id", userId).single();
  if (error) throw error;
  return { id: data.id, displayName: data.display_name, avatarUrl: ownAvatarUrl(data.avatar_path) };
}

export async function avatarPathOf(userId: string): Promise<string | null> {
  const { data, error } = await serviceClient().from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.avatar_path ?? null;
}

/**
 * Ganti nama profil. `applyToGroups` = nama panggilan di semua grup akun ini ikut diganti; grup yang sudah punya
 * anggota lain bernama sama dilewati (nama unik per grup) dan namanya dikembalikan agar pengguna tahu.
 */
export async function renameAccount(userId: string, displayName: string, applyToGroups: boolean): Promise<{ skipped: string[] }> {
  const db = serviceClient();
  const { error } = await db.from("profiles").update({ display_name: displayName }).eq("id", userId);
  if (error) throw error;
  if (!applyToGroups) return { skipped: [] };

  const { data: rows, error: listError } = await db
    .from("members")
    .select("id, display_name, groups!inner(name)")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (listError) throw listError;
  const skipped: string[] = [];
  for (const row of rows) {
    if (row.display_name === displayName) continue;
    const { error: renameError } = await db.from("members").update({ display_name: displayName }).eq("id", row.id);
    if (renameError?.code === "23505") skipped.push(row.groups.name);
    else if (renameError) throw renameError;
  }
  return { skipped: skipped.sort((a, b) => a.localeCompare(b, "id")) };
}

/** Ganti foto profil. Berkas lama dihapus setelah kolom diperbarui. */
export async function setAvatar(userId: string, file: File): Promise<string> {
  const { bytes, type, ext } = await readImageFile(file, MAX_AVATAR_BYTES, "Foto profil");
  const db = serviceClient();
  const old = await avatarPathOf(userId);
  const path = `${userId}/${randomUUID()}.${ext}`;
  const upload = await db.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) throw upload.error;
  const { error } = await db.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) {
    await db.storage.from(AVATAR_BUCKET).remove([path]);
    throw error;
  }
  if (old) await db.storage.from(AVATAR_BUCKET).remove([old]);
  return ownAvatarUrl(path)!;
}

export async function removeAvatar(userId: string): Promise<void> {
  const db = serviceClient();
  const old = await avatarPathOf(userId);
  if (!old) return;
  const { error } = await db.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) throw error;
  await db.storage.from(AVATAR_BUCKET).remove([old]);
}

/** Berkas foto profil, atau null. Akses diperiksa pemanggil. */
export async function readAvatar(userId: string): Promise<Blob | null> {
  const path = await avatarPathOf(userId);
  if (!path) return null;
  const file = await serviceClient().storage.from(AVATAR_BUCKET).download(path);
  if (file.error) throw file.error;
  return file.data;
}
