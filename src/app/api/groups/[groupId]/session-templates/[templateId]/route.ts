import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { deleteTemplate, updateTemplate } from "@/lib/db/session-templates";
import { HttpError } from "@/lib/http-error";
import { isUuid, sessionTemplatePatchSchema } from "@/lib/validation";

/** Ubah isi, jeda, atau lanjutkan jadwal (admin). Sesi yang sudah dibuat tidak berubah. */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/session-templates/[templateId]">>(async (request, { params }) => {
  const { groupId, templateId } = await params;
  if (!isUuid(templateId)) throw new HttpError(404, "Jadwal tidak ditemukan.");
  const { member } = await requireAdmin(groupId);
  await updateTemplate(groupId, templateId, member.id, await readJson(request, sessionTemplatePatchSchema));
  return new Response(null, { status: 204 });
});

/** Hapus jadwal (admin). Sesi yang sudah dibuat tetap ada. */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/session-templates/[templateId]">>(async (_request, { params }) => {
  const { groupId, templateId } = await params;
  if (!isUuid(templateId)) throw new HttpError(404, "Jadwal tidak ditemukan.");
  const { member } = await requireAdmin(groupId);
  await deleteTemplate(groupId, templateId, member.id);
  return new Response(null, { status: 204 });
});
