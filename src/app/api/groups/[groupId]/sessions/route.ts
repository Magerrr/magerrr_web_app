import { track } from "@/lib/analytics";
import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { getGroup } from "@/lib/db/groups";
import { createSession } from "@/lib/db/sessions";
import { sessionCreateSchema } from "@/lib/validation";

/** Buat sesi beserta peserta hadir dan biaya awal (admin). */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireAdmin(groupId);
  const input = await readJson(request, sessionCreateSchema);
  const id = await createSession(await getGroup(groupId), member.id, input);
  track("session_created", member.id, { group_id: groupId, session_id: id, attendees: new Set(input.attendeeIds).size, play_mode: input.playMode });
  return Response.json({ id }, { status: 201 });
});
