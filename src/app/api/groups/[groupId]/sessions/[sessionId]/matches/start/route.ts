import { readJson, route } from "@/lib/api";
import { startRound } from "@/lib/db/play";
import { startRoundSchema } from "@/lib/validation";
import { officialPlay } from "../../load";

/** Mulai match di lapangan kosong dengan susunan yang sudah disetujui admin atau wasit. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/matches/start">>(
  async (request, { params }) => {
    const { groupId, sessionId } = await params;
    const { ctx, actorId } = await officialPlay(groupId, sessionId);
    const ids = await startRound(ctx, actorId, await readJson(request, startRoundSchema));
    return Response.json({ ids }, { status: 201 });
  },
);
