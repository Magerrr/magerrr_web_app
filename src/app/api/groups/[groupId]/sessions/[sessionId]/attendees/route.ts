import { readJson, route } from "@/lib/api";
import { getGroup } from "@/lib/db/groups";
import { setAttendees } from "@/lib/db/sessions";
import { attendeesSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Tetapkan peserta hadir (admin); tagihan dihitung ulang. */
export const PUT = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/attendees">>(
  async (request, { params }) => {
    const { groupId, sessionId } = await params;
    const { membership, session } = await adminSession(groupId, sessionId);
    const { memberIds } = await readJson(request, attendeesSchema);
    const { reset } = await setAttendees(await getGroup(groupId), session, membership.member.id, memberIds);
    return Response.json({ presentCount: new Set(memberIds).size, reset });
  },
);
