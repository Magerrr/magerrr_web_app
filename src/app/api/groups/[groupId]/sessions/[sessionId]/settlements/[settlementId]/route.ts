import { readJson, route } from "@/lib/api";
import { setPaymentStatus } from "@/lib/db/bill";
import { HttpError } from "@/lib/http-error";
import { isUuid, paymentActionSchema } from "@/lib/validation";
import { adminSession } from "../../load";

/** Admin menandai lunas / batal lunas / menolak laporan "saya sudah bayar" (PRD P5). */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/settlements/[settlementId]">>(
  async (request, { params }) => {
    const { groupId, sessionId, settlementId } = await params;
    if (!isUuid(settlementId)) throw new HttpError(404, "Tagihan tidak ditemukan.");
    const { membership, session } = await adminSession(groupId, sessionId);
    const { action } = await readJson(request, paymentActionSchema);
    await setPaymentStatus(session.id, membership.member.id, settlementId, action, new Date());
    return Response.json({ ok: true });
  },
);
