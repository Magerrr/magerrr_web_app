import { readJson, route } from "@/lib/api";
import { getMembership, getUser, setGuestCookie } from "@/lib/db/authz";
import { findGroupByInvite } from "@/lib/db/groups";
import { joinGroup } from "@/lib/db/members";
import { HttpError } from "@/lib/http-error";
import { joinSchema } from "@/lib/validation";

/** Gabung lewat tautan undangan, dengan akun atau sebagai tamu (cookie claim_token). */
export const POST = route<RouteContext<"/api/join/[code]">>(async (request, { params }) => {
  const { code } = await params;
  const group = await findGroupByInvite(code);
  if (!group) throw new HttpError(404, "Tautan undangan tidak berlaku. Minta tautan baru ke admin grup.");

  const current = await getMembership(group.id);
  if (current) return Response.json({ groupId: group.id, memberId: current.member.id });

  const { displayName } = await readJson(request, joinSchema);
  const { member, claimToken } = await joinGroup(group.id, displayName, await getUser());
  if (claimToken) await setGuestCookie(group.id, claimToken);
  return Response.json({ groupId: group.id, memberId: member.id }, { status: 201 });
});
