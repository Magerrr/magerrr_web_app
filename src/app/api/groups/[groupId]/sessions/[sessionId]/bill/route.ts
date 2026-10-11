import { route } from "@/lib/api";
import { recomputeBill } from "@/lib/db/bill";
import { getGroup } from "@/lib/db/groups";
import { adminSession } from "../load";

/** Hitung ulang tagihan dari biaya tersimpan (mis. setelah pembulatan grup diubah). */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/bill">>(async (_request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  return Response.json(await recomputeBill(await getGroup(groupId), session, membership.member.id));
});
