import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { rotateInviteCode } from "@/lib/db/groups";

/** Buat tautan undangan baru; tautan lama berhenti berlaku (admin). */
export const POST = route<RouteContext<"/api/groups/[groupId]/invite">>(async (_request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireAdmin(groupId);
  const inviteCode = await rotateInviteCode(groupId, member.id);
  return Response.json({ inviteCode });
});
