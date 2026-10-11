import { route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { listMembers } from "@/lib/db/members";
import { qrisResponse, readQris } from "@/lib/db/payments";
import { isUuid } from "@/lib/validation";

/** Gambar QRIS anggota grup (untuk sesama anggota). */
export const GET = route<RouteContext<"/api/groups/[groupId]/payment-infos/[infoId]/qris">>(async (_request, { params }) => {
  const { groupId, infoId } = await params;
  await requireMember(groupId);
  if (!isUuid(infoId)) return qrisResponse(null);
  const members = await listMembers(groupId);
  return qrisResponse(await readQris(infoId, members.map((m) => m.id)));
});
