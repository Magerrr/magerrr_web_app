import { z } from "zod";
import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/db/authz";
import { closeSeason } from "@/lib/db/seasons";
import { HttpError } from "@/lib/http-error";
import { toJakartaParts } from "@/lib/time";
import { isUuid } from "@/lib/validation";

const schema = z.object({ action: z.literal("close") }).strict();

/** Tutup & arsipkan musim (admin); juara musim ditampilkan dari klasemen periode musim. */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/seasons/[seasonId]">>(async (request, { params }) => {
  const { groupId, seasonId } = await params;
  await requireAdmin(groupId);
  if (!isUuid(seasonId)) throw new HttpError(404, "Musim tidak ditemukan.");
  await readJson(request, schema);
  const now = new Date();
  await closeSeason(groupId, seasonId, toJakartaParts(now).date, now);
  return Response.json({ ok: true });
});
