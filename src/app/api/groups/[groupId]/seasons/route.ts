import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { createSeason } from "@/lib/db/seasons";
import { seasonSchema } from "@/lib/validation";

/** Buat musim (PRD L9, admin). Sesi di rentang tanggalnya otomatis masuk musim ini. */
export const POST = route<RouteContext<"/api/groups/[groupId]/seasons">>(async (request, { params }) => {
  const { groupId } = await params;
  await requireAdmin(groupId);
  const id = await createSeason(groupId, await readJson(request, seasonSchema));
  return Response.json({ id }, { status: 201 });
});
