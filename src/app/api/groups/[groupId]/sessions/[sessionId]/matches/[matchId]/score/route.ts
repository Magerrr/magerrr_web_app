import { readJson, route } from "@/lib/api";
import { saveLiveScore } from "@/lib/db/play";
import { liveScoreSchema } from "@/lib/validation";
import { scorerPlay } from "../../../load";

/** Skor live (nilai absolut semua game) untuk match yang sedang berjalan; admin atau pencatat skor lapangannya. */
export const PUT = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/matches/[matchId]/score">>(
  async (request, { params }) => {
    const { groupId, sessionId, matchId } = await params;
    const { ctx } = await scorerPlay(groupId, sessionId, matchId);
    const { games } = await readJson(request, liveScoreSchema);
    await saveLiveScore(ctx, matchId, games);
    return Response.json({ games });
  },
);
