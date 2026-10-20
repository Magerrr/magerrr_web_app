import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http-error";
import { imageType } from "@/lib/image-type";
import { serviceClient } from "./supabase";

/** Bucket privat untuk logo, sampul, dan momen grup (migrasi 0018); dibaca lewat route server. */
export const MEDIA_BUCKET = "group-media";

export type GroupImageKind = "logo" | "cover";
export const GROUP_IMAGE_KINDS: readonly GroupImageKind[] = ["logo", "cover"];

/** Batas setelah diperkecil di Perangkat (logo 512px, sampul 1600px); server tetap memeriksa. */
export const MAX_IMAGE_BYTES: Record<GroupImageKind, number> = { logo: 1024 * 1024, cover: 3 * 1024 * 1024 };
const LABEL: Record<GroupImageKind, string> = { logo: "Logo", cover: "Gambar sampul" };
const COLUMN = { logo: "logo_path", cover: "cover_path" } as const;

/** URL gambar grup lewat route server; `v` berubah tiap unggahan agar cache Perangkat tidak usang. */
export function groupImageUrl(groupId: string, kind: GroupImageKind, path: string | null): string | null {
  if (!path) return null;
  const version = path.split("/").pop()?.split(".")[0] ?? "";
  return `/api/groups/${groupId}/media/${kind}?v=${version}`;
}

/** Periksa ukuran & jenis (dari byte, bukan Content-Type kiriman); kembalikan byte dan ekstensi. */
export async function readImageFile(file: File, maxBytes: number, label: string): Promise<{ bytes: Uint8Array; type: string; ext: string }> {
  if (file.size === 0) throw new HttpError(422, `Pilih ${label.toLowerCase()}.`);
  if (file.size > maxBytes) throw new HttpError(422, `${label} maksimal ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) throw new HttpError(422, `${label} harus PNG, JPG, atau WebP.`);
  return { bytes, type, ext: type.split("/")[1] };
}

/** Ganti logo/sampul grup. Berkas lama dihapus setelah kolom diperbarui. Panggil hanya setelah requireAdmin. */
export async function setGroupImage(groupId: string, kind: GroupImageKind, file: File): Promise<string> {
  const { bytes, type, ext } = await readImageFile(file, MAX_IMAGE_BYTES[kind], LABEL[kind]);
  const db = serviceClient();
  const { data: current, error: findError } = await db.from("groups").select(COLUMN[kind]).eq("id", groupId).single();
  if (findError) throw findError;
  const old = (current as Record<string, string | null>)[COLUMN[kind]];

  const path = `${groupId}/${kind}/${randomUUID()}.${ext}`;
  const upload = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) throw upload.error;
  const { error } = await db.from("groups").update(kind === "logo" ? { logo_path: path } : { cover_path: path }).eq("id", groupId);
  if (error) {
    await db.storage.from(MEDIA_BUCKET).remove([path]);
    throw error;
  }
  if (old) await db.storage.from(MEDIA_BUCKET).remove([old]);
  return groupImageUrl(groupId, kind, path)!;
}

/** Hapus logo/sampul grup. Panggil hanya setelah requireAdmin. */
export async function removeGroupImage(groupId: string, kind: GroupImageKind): Promise<void> {
  const db = serviceClient();
  const { data, error } = await db.from("groups").select(COLUMN[kind]).eq("id", groupId).single();
  if (error) throw error;
  const old = (data as Record<string, string | null>)[COLUMN[kind]];
  if (!old) return;
  const { error: updateError } = await db.from("groups").update(kind === "logo" ? { logo_path: null } : { cover_path: null }).eq("id", groupId);
  if (updateError) throw updateError;
  await db.storage.from(MEDIA_BUCKET).remove([old]);
}

/** Berkas gambar grup, atau null bila belum ada. Akses diperiksa pemanggil. */
export async function readGroupImage(groupId: string, kind: GroupImageKind): Promise<Blob | null> {
  const db = serviceClient();
  const { data, error } = await db.from("groups").select(COLUMN[kind]).eq("id", groupId).maybeSingle();
  if (error) throw error;
  const path = (data as Record<string, string | null> | null)?.[COLUMN[kind]];
  if (!path) return null;
  return readMedia(path);
}

export async function readMedia(path: string): Promise<Blob | null> {
  const file = await serviceClient().storage.from(MEDIA_BUCKET).download(path);
  if (file.error) throw file.error;
  return file.data;
}

/** Response gambar grup: cache pribadi (URL berversi), tidak ditebak sebagai HTML. */
export function imageResponse(blob: Blob | null): Response {
  if (!blob) return Response.json({ error: "Gambar tidak ditemukan." }, { status: 404 });
  return new Response(blob, {
    headers: {
      "content-type": blob.type || "image/jpeg",
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Semua berkas grup di bucket media (untuk hapus grup). */
export async function groupMediaPaths(groupId: string): Promise<string[]> {
  const db = serviceClient();
  const paths: string[] = [];
  const limit = 1000;
  for (const folder of ["logo", "cover", "moments"]) {
    for (let offset = 0; ; offset += limit) {
      const { data, error } = await db.storage.from(MEDIA_BUCKET).list(`${groupId}/${folder}`, { limit, offset });
      if (error) throw error;
      paths.push(...data.map((f) => `${groupId}/${folder}/${f.name}`));
      if (data.length < limit) break;
    }
  }
  return paths;
}
