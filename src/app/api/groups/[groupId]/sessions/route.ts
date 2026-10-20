import { track } from "@/lib/analytics";
import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { getGroup } from "@/lib/db/groups";
import { createSeries } from "@/lib/db/session-series";
import { createSession, getSession } from "@/lib/db/sessions";
import { HttpError } from "@/lib/http-error";
import { toJakartaParts } from "@/lib/time";
import { sessionCreateSchema } from "@/lib/validation";

/** Buat sesi beserta peserta hadir dan biaya awal (admin); opsional langsung berulang (S5). */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireAdmin(groupId);
  const input = await readJson(request, sessionCreateSchema);
  const id = await createSession(await getGroup(groupId), member.id, input);
  if (input.repeat) {
    const session = await getSession(groupId, id);
    if (!session) throw new HttpError(404, "Sesi tidak ditemukan.");
    await createSeries(session, member.id, input.repeat, { courtPerHour: input.costs.courtPerHour, shuttle: input.costs.shuttle }, toJakartaParts(new Date()).date);
  }
  track("session_created", member.id, { group_id: groupId, session_id: id, attendees: new Set(input.attendeeIds).size, play_mode: input.playMode });
  return Response.json({ id }, { status: 201 });
});
