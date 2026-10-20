import { route } from "@/lib/api";
import { getMembership, requireAdmin } from "@/lib/db/authz";
import { GROUP_IMAGE_KINDS, MAX_IMAGE_BYTES, imageResponse, readGroupImage, removeGroupImage, setGroupImage, type GroupImageKind } from "@/lib/db/group-media";
import { findPublicGroup } from "@/lib/db/groups";
import { HttpError } from "@/lib/http-error";

function imageKind(kind: string): GroupImageKind {
  if (!(GROUP_IMAGE_KINDS as readonly string[]).includes(kind)) throw new HttpError(404, "Tidak ditemukan.");
  return kind as GroupImageKind;
}

/** Logo / sampul grup: untuk anggota, atau siapa pun bila grup publik (daftar Jelajahi). */
export const GET = route<RouteContext<"/api/groups/[groupId]/media/[kind]">>(async (_request, { params }) => {
  const { groupId, kind } = await params;
  const k = imageKind(kind);
  if (!(await getMembership(groupId)) && !(await findPublicGroup(groupId))) return imageResponse(null);
  return imageResponse(await readGroupImage(groupId, k));
});

/** Unggah logo / sampul (admin; multipart `file`). Gambar sudah diperkecil di Perangkat. */
export const POST = route<RouteContext<"/api/groups/[groupId]/media/[kind]">>(async (request, { params }) => {
  const { groupId, kind } = await params;
  const k = imageKind(kind);
  await requireAdmin(groupId);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "Kirim gambar sebagai form.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES[k] + 64 * 1024) {
    throw new HttpError(422, `Gambar maksimal ${Math.round(MAX_IMAGE_BYTES[k] / 1024 / 1024)} MB.`);
  }
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "Form tidak valid.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Pilih gambar.");
  return Response.json({ url: await setGroupImage(groupId, k, file) }, { status: 201 });
});

/** Hapus logo / sampul (admin). */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/media/[kind]">>(async (_request, { params }) => {
  const { groupId, kind } = await params;
  const k = imageKind(kind);
  await requireAdmin(groupId);
  await removeGroupImage(groupId, k);
  return new Response(null, { status: 204 });
});
