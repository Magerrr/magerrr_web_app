import { readJson, route } from "@/lib/api";
import { getGroup } from "@/lib/db/groups";
import { deleteSession, updateSession } from "@/lib/db/sessions";
import { sessionUpdateSchema } from "@/lib/validation";
import { adminSession } from "./load";

/** Ubah detail sesi (admin); sesi selesai tidak bisa diubah. */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { session } = await adminSession(groupId, sessionId);
  const input = await readJson(request, sessionUpdateSchema);
  await updateSession(await getGroup(groupId), session, input);
  return Response.json({ id: session.id });
});

/** Hapus sesi beserta match, biaya, dan tagihannya (admin, MAGERRR-17). Dicatat di audit_log. */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]">>(async (_request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  await deleteSession(session, membership.member.id);
  return new Response(null, { status: 204 });
});
