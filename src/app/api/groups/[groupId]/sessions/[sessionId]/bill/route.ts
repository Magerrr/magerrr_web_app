import { readJson, route } from "@/lib/api";
import { recomputeBill, setFlatFee } from "@/lib/db/bill";
import { getGroup } from "@/lib/db/groups";
import { flatFeeSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Hitung ulang tagihan dari biaya tersimpan (mis. setelah pembulatan grup diubah). */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/bill">>(async (_request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  return Response.json(await recomputeBill(await getGroup(groupId), session, membership.member.id));
});

/** Ganti cara patungan: bagi rata (`flatFee: null`) atau iuran flat per peserta (admin, MAGERRR-14). */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/bill">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  const { flatFee } = await readJson(request, flatFeeSchema);
  return Response.json(await setFlatFee(await getGroup(groupId), session, membership.member.id, flatFee));
});
