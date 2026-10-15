import { readJson, route } from "@/lib/api";
import { getMembership, getUser, setGuestCookie } from "@/lib/db/authz";
import { findPublicGroup } from "@/lib/db/groups";
import { joinGroup } from "@/lib/db/members";
import { HttpError } from "@/lib/http-error";
import { joinSchema } from "@/lib/validation";

/** Gabung terbuka ke grup publik (MAGERRR-6), dengan akun atau sebagai tamu (cookie claim_token). Grup privat → 404. */
export const POST = route<RouteContext<"/api/groups/[groupId]/join">>(async (request, { params }) => {
  const { groupId } = await params;
  const group = await findPublicGroup(groupId);
  if (!group) throw new HttpError(404, "Grup ini privat atau tidak ada. Minta tautan undangan ke admin grup.");

  const current = await getMembership(group.id);
  if (current) return Response.json({ groupId: group.id, memberId: current.member.id });

  const { displayName } = await readJson(request, joinSchema);
  const { member, claimToken } = await joinGroup(group.id, displayName, await getUser());
  if (claimToken) await setGuestCookie(group.id, claimToken);
  return Response.json({ groupId: group.id, memberId: member.id }, { status: 201 });
});
