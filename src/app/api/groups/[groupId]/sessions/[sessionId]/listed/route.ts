import { readJson, route } from "@/lib/api";
import { setListed } from "@/lib/db/sessions";
import { sessionListedSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Tampilkan / sembunyikan sesi dari pencarian publik (admin, #15). Perubahan dicatat di audit_log. */
export const PUT = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/listed">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  const { listed } = await readJson(request, sessionListedSchema);
  await setListed(session, listed, membership.member.id);
  return Response.json({ listed });
});
