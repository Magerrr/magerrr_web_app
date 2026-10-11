import { readJson, route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { addPaymentInfo } from "@/lib/db/payments";
import { paymentInfoSchema } from "@/lib/validation";

/** Tambah rekening bank / e-wallet milik sendiri (PRD P6). */
export const POST = route<RouteContext<"/api/groups/[groupId]/payment-infos">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireMember(groupId);
  const info = await addPaymentInfo(member.id, await readJson(request, paymentInfoSchema));
  return Response.json(info, { status: 201 });
});
