import { route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { deleteMoment } from "@/lib/db/moments";
import { HttpError } from "@/lib/http-error";
import { isUuid } from "@/lib/validation";

/** Hapus foto momen: pengunggahnya atau admin grup. */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/moments/[momentId]">>(async (_request, { params }) => {
  const { groupId, momentId } = await params;
  const membership = await requireMember(groupId);
  if (!isUuid(momentId)) throw new HttpError(404, "Foto tidak ditemukan.");
  await deleteMoment(groupId, membership, momentId);
  return new Response(null, { status: 204 });
});
