import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { updateMember } from "@/lib/db/members";
import { HttpError } from "@/lib/http-error";
import { isUuid, memberUpdateSchema } from "@/lib/validation";

/** Ubah grade atau peran anggota (admin). */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/members/[memberId]">>(
  async (request, { params }) => {
    const { groupId, memberId } = await params;
    const { member } = await requireAdmin(groupId);
    if (!isUuid(memberId)) throw new HttpError(404, "Anggota tidak ditemukan.");
    const patch = await readJson(request, memberUpdateSchema);
    return Response.json(await updateMember(groupId, member, memberId, patch));
  },
);
