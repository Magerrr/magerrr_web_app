import { route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { addQris, MAX_QRIS_BYTES } from "@/lib/db/payments";
import { HttpError } from "@/lib/http-error";
import { qrisLabelSchema } from "@/lib/validation";

/** Unggah gambar QRIS milik sendiri ke Storage (multipart: label, file). */
export const POST = route<RouteContext<"/api/groups/[groupId]/payment-infos/qris">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireMember(groupId);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "Kirim gambar sebagai form.");
  }
  // Tolak sebelum membaca body bila jelas terlalu besar (batas file + ruang untuk field lain).
  if (Number(request.headers.get("content-length") ?? 0) > MAX_QRIS_BYTES + 64 * 1024) {
    throw new HttpError(422, "Gambar QRIS maksimal 2 MB.");
  }
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "Form tidak valid.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Pilih gambar QRIS.");
  const label = qrisLabelSchema.parse(String(form.get("label") ?? ""));
  return Response.json(await addQris(groupId, member.id, label, file), { status: 201 });
});
