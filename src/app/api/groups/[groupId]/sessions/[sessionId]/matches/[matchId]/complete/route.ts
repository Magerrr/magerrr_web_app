import { recordMetric } from "@/lib/db/metrics";
import { track } from "@/lib/analytics";
import { readJson, route } from "@/lib/api";
import { completeMatch } from "@/lib/db/play";
import { liveScoreSchema } from "@/lib/validation";
import { scorerPlay } from "../../../load";

/** Selesaikan match berjalan; mode rotasi langsung memulai match berikutnya di lapangan itu. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/matches/[matchId]/complete">>(
  async (request, { params }) => {
    const { groupId, sessionId, matchId } = await params;
    const { ctx, actorId } = await scorerPlay(groupId, sessionId, matchId);
    const { games } = await readJson(request, liveScoreSchema);
    await completeMatch(ctx, actorId, matchId, games);
    await recordMetric(groupId, sessionId, "score_recorded");
    track("match_completed", actorId, { group_id: groupId, session_id: sessionId, match_id: matchId, source: "live" });
    return Response.json({ id: matchId });
  },
);
