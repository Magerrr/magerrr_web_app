import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { createTemplate } from "@/lib/db/session-templates";
import { durationBetween } from "@/lib/core/recurrence";
import { sessionTemplateSchema } from "@/lib/validation";

/** Buat jadwal sesi mingguan (admin). Sesinya dibuat job terjadwal, bukan di sini. */
export const POST = route<RouteContext<"/api/groups/[groupId]/session-templates">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireAdmin(groupId);
  const input = await readJson(request, sessionTemplateSchema);
  durationBetween(input.startTime, input.endTime);
  const id = await createTemplate(groupId, member.id, input);
  return Response.json({ id }, { status: 201 });
});
