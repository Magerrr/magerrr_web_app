import { readJson, route } from "@/lib/api";
import { getMembership, isGroupAdmin } from "@/lib/db/authz";
import { deviceId, recordMetric, viewerKey } from "@/lib/db/metrics";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { openEventSchema } from "@/lib/validation";

/**
 * Link sesi/recap dibuka oleh non-host (PRD §4). Unik per anggota atau perangkat per sesi; host (pembuat sesi
 * atau admin) tidak dihitung. Hanya hash satu arah yang disimpan.
 */
export const POST = route(async (request) => {
  const { token } = await readJson(request, openEventSchema);
  const session = await findSessionByShareToken(token);
  if (session) {
    const membership = await getMembership(session.groupId);
    const host = membership !== null && (isGroupAdmin(membership) || membership.member.id === session.createdBy);
    if (!host) {
      const identity = membership ? `m:${membership.member.id}` : `d:${await deviceId()}`;
      await recordMetric(session.groupId, session.id, "link_opened", viewerKey(session.id, identity));
    }
  }
  return new Response(null, { status: 204 });
});
