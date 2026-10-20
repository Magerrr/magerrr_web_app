import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { deleteSeries, updateSeries } from "@/lib/db/session-series";
import { HttpError } from "@/lib/http-error";
import { toJakartaParts } from "@/lib/time";
import { isUuid, seriesPatchSchema } from "@/lib/validation";

/** Ubah pengulangan & biaya default, atau jeda/lanjutkan (admin). Sesi yang sudah dibuat tidak berubah. */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/series/[seriesId]">>(async (request, { params }) => {
  const { groupId, seriesId } = await params;
  if (!isUuid(seriesId)) throw new HttpError(404, "Pengulangan tidak ditemukan.");
  const { member } = await requireAdmin(groupId);
  await updateSeries(groupId, seriesId, member.id, await readJson(request, seriesPatchSchema), toJakartaParts(new Date()).date);
  return new Response(null, { status: 204 });
});

/** Hentikan pengulangan (admin). Sesi yang sudah dibuat tetap ada. */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/series/[seriesId]">>(async (_request, { params }) => {
  const { groupId, seriesId } = await params;
  if (!isUuid(seriesId)) throw new HttpError(404, "Pengulangan tidak ditemukan.");
  const { member } = await requireAdmin(groupId);
  await deleteSeries(groupId, seriesId, member.id);
  return new Response(null, { status: 204 });
});
