import { track } from "@/lib/analytics";
import { readJson, route } from "@/lib/api";
import { getMembership } from "@/lib/db/authz";
import { recordMetric } from "@/lib/db/metrics";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { HttpError } from "@/lib/http-error";
import { shareEventSchema } from "@/lib/validation";

/** Event "tagihan/recap dibagikan" dari klien. Pengunjung tanpa akun dicatat anonim. */
export const POST = route(async (request) => {
  const { event, token, channel } = await readJson(request, shareEventSchema);
  const session = await findSessionByShareToken(token);
  if (!session) throw new HttpError(404, "Sesi tidak ditemukan.");
  const membership = await getMembership(session.groupId);
  if (event === "recap_shared") await recordMetric(session.groupId, session.id, "recap_shared");
  track(event, membership?.member.id ?? "anonim", { group_id: session.groupId, session_id: session.id, channel });
  return new Response(null, { status: 204 });
});
