import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { getGroup } from "@/lib/db/groups";
import { updateMember } from "@/lib/db/members";
import { removeFromPlannedSessions } from "@/lib/db/sessions";
import { HttpError } from "@/lib/http-error";
import { isUuid, memberUpdateSchema } from "@/lib/validation";

/** Ubah grade atau peran anggota (admin). */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/members/[memberId]">>(
  async (request, { params }) => {
    const { groupId, memberId } = await params;
    const { member } = await requireAdmin(groupId);
    if (!isUuid(memberId)) throw new HttpError(404, "Anggota tidak ditemukan.");
    const patch = await readJson(request, memberUpdateSchema);
    const updated = await updateMember(groupId, member, memberId, patch);
    // Wasit tidak ikut bermain (MAGERRR-11): keluar dari peserta sesi yang belum dimulai.
    if (patch.role === "referee") await removeFromPlannedSessions(await getGroup(groupId), memberId, member.id);
    return Response.json(updated);
  },
);
