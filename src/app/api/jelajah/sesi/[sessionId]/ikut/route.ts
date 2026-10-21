import { readJson, route } from "@/lib/api";
import { canPlay } from "@/lib/core/roles";
import { joinBlockReason } from "@/lib/core/rsvp";
import { getMembership, getUser, setGuestCookie } from "@/lib/db/authz";
import { joinGroup } from "@/lib/db/members";
import { findPublicSessionRef, rsvpGoing } from "@/lib/db/sessions";
import { HttpError } from "@/lib/http-error";
import { isUuid, joinSchema } from "@/lib/validation";

const NOT_FOUND = "Sesi tidak ditemukan atau grupnya privat.";

/**
 * Ikut sesi dari Jelajah (MAGERRR-19): gabung grup publik bila belum anggota (akun, atau tamu dengan displayName + cookie
 * claim_token), lalu RSVP "ikut" lewat RPC atomik. Idempoten. Grup privat / sesi tidak ada → 404 yang sama.
 * Gabung tamu mewarisi celah /api/groups/[id]/join (belum ada rate limit), lihat docs/DECISIONS.md.
 */
export const POST = route<RouteContext<"/api/jelajah/sesi/[sessionId]/ikut">>(async (request, { params }) => {
  const { sessionId } = await params;
  const session = isUuid(sessionId) ? await findPublicSessionRef(sessionId) : null;
  if (!session) throw new HttpError(404, NOT_FOUND);

  const blocked = joinBlockReason(session, new Date());
  if (blocked) throw new HttpError(422, blocked);

  const current = await getMembership(session.groupId);
  let memberId: string;
  if (current) {
    if (!canPlay(current.member.role)) {
      throw new HttpError(422, "Wasit tidak ikut bermain, jadi tidak perlu menjawab ikut atau tidak.");
    }
    memberId = current.member.id;
  } else {
    const { displayName } = await readJson(request, joinSchema);
    const { member, claimToken } = await joinGroup(session.groupId, displayName, await getUser());
    if (claimToken) await setGuestCookie(session.groupId, claimToken);
    memberId = member.id;
  }

  await rsvpGoing(session.id, memberId);
  return new Response(null, { status: 303, headers: { Location: `/g/${session.groupId}/sesi/${session.id}` } });
});
