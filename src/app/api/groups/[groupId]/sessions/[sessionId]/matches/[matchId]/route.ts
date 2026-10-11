import { readJson, route } from "@/lib/api";
import { saveResult } from "@/lib/db/play";
import { matchResultSchema } from "@/lib/validation";
import { adminPlay } from "../../load";

/** Edit hasil match yang sudah selesai; tercatat di audit_log (SC7). */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/matches/[matchId]">>(
  async (request, { params }) => {
    const { groupId, sessionId, matchId } = await params;
    const { ctx, actorId } = await adminPlay(groupId, sessionId);
    const id = await saveResult(ctx, actorId, await readJson(request, matchResultSchema), matchId);
    return Response.json({ id });
  },
);
