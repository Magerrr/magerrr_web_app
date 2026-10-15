import { readJson, route } from "@/lib/api";
import { canPlay } from "@/lib/core/roles";
import { requireMember } from "@/lib/db/authz";
import { getSession, setRsvp } from "@/lib/db/sessions";
import { HttpError } from "@/lib/http-error";
import { isUuid, rsvpSchema } from "@/lib/validation";

/** RSVP anggota untuk dirinya sendiri (PRD S3): akun atau tamu lewat cookie undangan. */
export const PUT = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/rsvp">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { member } = await requireMember(groupId);
  if (!canPlay(member.role)) throw new HttpError(422, "Wasit tidak ikut bermain, jadi tidak perlu menjawab ikut atau tidak.");
  const session = isUuid(sessionId) ? await getSession(groupId, sessionId) : null;
  if (!session) throw new HttpError(404, "Sesi tidak ditemukan.");
  const { rsvp } = await readJson(request, rsvpSchema);
  await setRsvp(session, member.id, rsvp);
  return Response.json({ rsvp });
});
