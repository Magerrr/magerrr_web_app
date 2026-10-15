import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { deleteGroup, getGroup, updateGroup } from "@/lib/db/groups";
import { HttpError } from "@/lib/http-error";
import { groupDeleteSchema, groupSettingsSchema } from "@/lib/validation";

/** Ubah nama & aturan grup (admin). Klasemen selalu dihitung ulang dari data match. */
export const PATCH = route<RouteContext<"/api/groups/[groupId]">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireAdmin(groupId);
  const patch = await readJson(request, groupSettingsSchema);
  await updateGroup(groupId, member.id, patch);
  return Response.json(await getGroup(groupId));
});

/** Hapus grup beserta semua datanya (admin). Wajib mengetik ulang nama grup; tidak bisa dibatalkan. */
export const DELETE = route<RouteContext<"/api/groups/[groupId]">>(async (request, { params }) => {
  const { groupId } = await params;
  await requireAdmin(groupId);
  const { confirmName } = await readJson(request, groupDeleteSchema);
  const group = await getGroup(groupId);
  if (confirmName !== group.name.trim()) throw new HttpError(422, "Nama grup tidak cocok. Ketik persis seperti nama grup.");
  await deleteGroup(groupId);
  return new Response(null, { status: 204 });
});
