import { track } from "@/lib/analytics";
import { readJson, route } from "@/lib/api";
import { saveResult } from "@/lib/db/play";
import { matchResultSchema } from "@/lib/validation";
import { adminPlay } from "../load";

/** Catat skor akhir match secara manual (SC11). */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/matches">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { ctx, actorId } = await adminPlay(groupId, sessionId);
  const id = await saveResult(ctx, actorId, await readJson(request, matchResultSchema));
  track("match_completed", actorId, { group_id: groupId, session_id: sessionId, match_id: id, source: "manual" });
  return Response.json({ id }, { status: 201 });
});
