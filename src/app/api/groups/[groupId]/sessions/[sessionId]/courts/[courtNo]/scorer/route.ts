import { readJson, route } from "@/lib/api";
import { setCourtScorer } from "@/lib/db/play";
import { HttpError } from "@/lib/http-error";
import { courtScorerSchema } from "@/lib/validation";
import { memberPlay } from "../../../load";

/**
 * Pencatat skor lapangan (ALGORITHMS §1d). Admin menunjuk/mengganti/mengosongkan; anggota lain mengajukan diri
 * (`memberId` = dirinya) saat lapangan belum punya pencatat, atau melepas kontrolnya (`memberId: null`).
 */
export const PUT = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/courts/[courtNo]/scorer">>(
  async (request, { params }) => {
    const { groupId, sessionId, courtNo } = await params;
    const court = Number(courtNo);
    if (!/^\d{1,2}$/.test(courtNo) || court < 1) throw new HttpError(404, "Lapangan tidak ditemukan.");
    const { actor, ctx } = await memberPlay(groupId, sessionId);
    const { memberId } = await readJson(request, courtScorerSchema);
    return Response.json({ memberId: await setCourtScorer(ctx, actor, court, memberId) });
  },
);
