import { route } from "@/lib/api";
import { clearGuestCookie, requireUser } from "@/lib/db/authz";
import { claimProfile } from "@/lib/db/members";

/** Klaim profil tamu ke akun yang sedang login (PRD G6). */
export const POST = route<RouteContext<"/api/claim/[token]">>(async (_request, { params }) => {
  const { token } = await params;
  const user = await requireUser();
  const target = await claimProfile(token, user);
  await clearGuestCookie(target.groupId);
  return Response.json({ groupId: target.groupId, memberId: target.memberId });
});
