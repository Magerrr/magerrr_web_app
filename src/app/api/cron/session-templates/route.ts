import { timingSafeEqual } from "node:crypto";
import { route } from "@/lib/api";
import { generateDueSessions, todayWib } from "@/lib/db/session-templates";
import { HttpError } from "@/lib/http-error";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(401, "Tidak diizinkan.");
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Job terjadwal (harian): buat sesi Rencana dari jadwal mingguan. Idempoten; dilindungi `Authorization: Bearer $CRON_SECRET`. */
export const POST = route(async (request) => {
  if (!authorized(request)) throw new HttpError(401, "Tidak diizinkan.");
  return Response.json(await generateDueSessions(todayWib(new Date())));
});
