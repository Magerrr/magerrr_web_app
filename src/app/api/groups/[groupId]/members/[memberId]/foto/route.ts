import { route } from "@/lib/api";
import { readAvatar } from "@/lib/db/account";
import { getMembership } from "@/lib/db/authz";
import { imageResponse } from "@/lib/db/group-media";
import { getMemberProfile } from "@/lib/db/profile";
import { isUuid } from "@/lib/validation";

/** Foto profil akun anggota (MAGERRR-12): hanya untuk sesama anggota grup. Tamu tidak punya foto. */
export const GET = route<RouteContext<"/api/groups/[groupId]/members/[memberId]/foto">>(async (_request, { params }) => {
  const { groupId, memberId } = await params;
  if (!isUuid(memberId) || !(await getMembership(groupId))) return imageResponse(null);
  const member = await getMemberProfile(groupId, memberId);
  return imageResponse(member?.userId ? await readAvatar(member.userId) : null);
});
