import { route } from "@/lib/api";
import { MAX_AVATAR_BYTES, readAvatar, removeAvatar, setAvatar } from "@/lib/db/account";
import { requireUser } from "@/lib/db/authz";
import { imageResponse } from "@/lib/db/group-media";
import { HttpError } from "@/lib/http-error";

/** Foto profil sendiri. */
export const GET = route(async () => {
  const user = await requireUser();
  return imageResponse(await readAvatar(user.id));
});

/** Unggah foto profil (multipart `file`). Foto sudah dipotong persegi & diperkecil di Perangkat. */
export const POST = route(async (request) => {
  const user = await requireUser();
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "Kirim gambar sebagai form.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_AVATAR_BYTES + 64 * 1024) {
    throw new HttpError(422, "Foto profil maksimal 1 MB.");
  }
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "Form tidak valid.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Pilih foto.");
  return Response.json({ url: await setAvatar(user.id, file) }, { status: 201 });
});

export const DELETE = route(async () => {
  const user = await requireUser();
  await removeAvatar(user.id);
  return new Response(null, { status: 204 });
});
