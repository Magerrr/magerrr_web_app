import { route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { MAX_MOMENT_BYTES, addMoment } from "@/lib/db/moments";
import { HttpError } from "@/lib/http-error";
import { momentFieldsSchema } from "@/lib/validation";

/** Unggah foto momen grup (anggota mana pun; multipart `file`, `caption`, `sessionId`). */
export const POST = route<RouteContext<"/api/groups/[groupId]/moments">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireMember(groupId);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "Kirim foto sebagai form.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_MOMENT_BYTES + 64 * 1024) {
    throw new HttpError(422, "Foto maksimal 3 MB.");
  }
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "Form tidak valid.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Pilih foto.");
  const fields = momentFieldsSchema.parse({ caption: String(form.get("caption") ?? ""), sessionId: String(form.get("sessionId") ?? "") });
  const id = await addMoment(groupId, member.id, file, fields);
  return Response.json({ id }, { status: 201 });
});
