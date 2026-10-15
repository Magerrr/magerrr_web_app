import "server-only";
import { canOfficiate, requireAdmin, requireMember, requireOfficial } from "@/lib/db/authz";
import { getGroup } from "@/lib/db/groups";
import { assertCanScore, loadPlay } from "@/lib/db/play";
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

/** Konteks permainan sesi untuk route handler admin (mis. buat turnamen). */
export async function adminPlay(groupId: string, sessionId: string) {
  const { membership, session } = await adminSession(groupId, sessionId);
  return { actorId: membership.member.id, ctx: await loadPlay(await getGroup(groupId), session) };
}

/** Konteks permainan untuk pengurus permainan (admin atau wasit): kocok, mulai ronde, ubah/batalkan match, pasangan. */
export async function officialPlay(groupId: string, sessionId: string) {
  const membership = await requireOfficial(groupId);
  const session = isUuid(sessionId) ? await getSession(groupId, sessionId) : null;
  if (!session) throw new HttpError(404, "Sesi tidak ditemukan.");
  return { actorId: membership.member.id, ctx: await loadPlay(await getGroup(groupId), session) };
}

/** Konteks permainan untuk anggota mana pun (pencatat skor); `actor` dipakai untuk aturan pencatat (ALGORITHMS §1d). */
export async function memberPlay(groupId: string, sessionId: string) {
  const membership = await requireMember(groupId);
  const session = isUuid(sessionId) ? await getSession(groupId, sessionId) : null;
  if (!session) throw new HttpError(404, "Sesi tidak ditemukan.");
  const actor = { id: membership.member.id, isOfficial: canOfficiate(membership) };
  return { actor, ctx: await loadPlay(await getGroup(groupId), session) };
}

/** Konteks untuk menulis skor match berjalan: admin/wasit, atau pencatat skor lapangannya. */
export async function scorerPlay(groupId: string, sessionId: string, matchId: string) {
  const play = await memberPlay(groupId, sessionId);
  assertCanScore(play.ctx, play.actor, matchId);
  return { actorId: play.actor.id, ctx: play.ctx };
}
