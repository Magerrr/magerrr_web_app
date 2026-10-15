import { readJson, route } from "@/lib/api";
import { proposeRound } from "@/lib/db/play";
import { planSchema } from "@/lib/validation";
import { officialPlay } from "../load";

/** Usulan susunan ronde untuk lapangan kosong terpilih (kocok: planRound ber-seed; rotasi: antrian). Tidak menyimpan apa pun. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/plan">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { ctx } = await officialPlay(groupId, sessionId);
  const { kind, seed, courts } = await readJson(request, planSchema);
  return Response.json(await proposeRound(ctx, kind, seed, courts));
});
