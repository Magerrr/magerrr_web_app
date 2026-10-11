import "server-only";
import { requireAdmin } from "@/lib/db/authz";
import { getGroup } from "@/lib/db/groups";
import { loadPlay } from "@/lib/db/play";
import { getSession } from "@/lib/db/sessions";
import { HttpError } from "@/lib/http-error";
import { isUuid } from "@/lib/validation";

/** Sesi milik grup untuk route handler tulis (admin). */
export async function adminSession(groupId: string, sessionId: string) {
  const membership = await requireAdmin(groupId);
  const session = isUuid(sessionId) ? await getSession(groupId, sessionId) : null;
  if (!session) throw new HttpError(404, "Sesi tidak ditemukan.");
  return { membership, session };
}

/** Konteks permainan sesi untuk route handler skor (admin). */
export async function adminPlay(groupId: string, sessionId: string) {
  const { membership, session } = await adminSession(groupId, sessionId);
  return { actorId: membership.member.id, ctx: await loadPlay(await getGroup(groupId), session) };
}
