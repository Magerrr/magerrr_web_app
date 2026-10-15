import { route } from "@/lib/api";
import { voidMatch } from "@/lib/db/play";
import { officialPlay } from "../../../load";

/** Batalkan match (tidak dihitung di klasemen); tercatat di audit_log. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/matches/[matchId]/void">>(
  async (_request, { params }) => {
    const { groupId, sessionId, matchId } = await params;
    const { ctx, actorId } = await officialPlay(groupId, sessionId);
    await voidMatch(ctx, actorId, matchId);
    return Response.json({ id: matchId });
  },
);
