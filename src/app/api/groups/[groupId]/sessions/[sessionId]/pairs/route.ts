import { readJson, route } from "@/lib/api";
import { savePairs } from "@/lib/db/play";
import { fixedPairsSchema } from "@/lib/validation";
import { adminPlay } from "../load";

/** Atur pasangan tetap (mode fix_pasangan): `{auto: true}` seimbang menurut rating, atau `{pairs}` manual. */
export const PUT = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/pairs">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { ctx } = await adminPlay(groupId, sessionId);
  return Response.json(await savePairs(ctx, await readJson(request, fixedPairsSchema)));
});
