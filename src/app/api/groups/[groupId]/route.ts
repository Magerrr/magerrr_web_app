import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { getGroup, updateGroup } from "@/lib/db/groups";
import { groupSettingsSchema } from "@/lib/validation";

/** Ubah nama & aturan grup (admin). Klasemen selalu dihitung ulang dari data match. */
export const PATCH = route<RouteContext<"/api/groups/[groupId]">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireAdmin(groupId);
  const patch = await readJson(request, groupSettingsSchema);
  await updateGroup(groupId, member.id, patch);
  return Response.json(await getGroup(groupId));
});
