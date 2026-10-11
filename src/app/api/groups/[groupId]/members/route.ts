import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { addGuest } from "@/lib/db/members";
import { memberCreateSchema } from "@/lib/validation";

/** Tambah pemain tamu (hanya nama) (admin). */
export const POST = route<RouteContext<"/api/groups/[groupId]/members">>(async (request, { params }) => {
  const { groupId } = await params;
  await requireAdmin(groupId);
  const { displayName } = await readJson(request, memberCreateSchema);
  return Response.json(await addGuest(groupId, displayName), { status: 201 });
});
