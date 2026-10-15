import { route } from "@/lib/api";
import { getMembership } from "@/lib/db/authz";
import { imageResponse } from "@/lib/db/group-media";
import { findPublicGroup } from "@/lib/db/groups";
import { readMomentImage } from "@/lib/db/moments";
import { isUuid } from "@/lib/validation";

/** Foto momen: untuk anggota, atau siapa pun bila grup publik (gambar kecil di Jelajahi). */
export const GET = route<RouteContext<"/api/groups/[groupId]/moments/[momentId]/image">>(async (_request, { params }) => {
  const { groupId, momentId } = await params;
  if (!isUuid(momentId)) return imageResponse(null);
  if (!(await getMembership(groupId)) && !(await findPublicGroup(groupId))) return imageResponse(null);
  return imageResponse(await readMomentImage(groupId, momentId));
});
