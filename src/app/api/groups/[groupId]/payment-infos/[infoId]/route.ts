import { route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { deletePaymentInfo } from "@/lib/db/payments";
import { HttpError } from "@/lib/http-error";
import { isUuid } from "@/lib/validation";

/** Hapus info pembayaran milik sendiri. */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/payment-infos/[infoId]">>(async (_request, { params }) => {
  const { groupId, infoId } = await params;
  const { member } = await requireMember(groupId);
  if (!isUuid(infoId)) throw new HttpError(404, "Info pembayaran tidak ditemukan.");
  await deletePaymentInfo(member.id, infoId);
  return Response.json({ ok: true });
});
