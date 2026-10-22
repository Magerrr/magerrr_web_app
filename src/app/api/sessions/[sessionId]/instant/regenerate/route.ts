import { route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { findSessionGroupId, rotateInstantToken } from "@/lib/db/sessions";
import { publicEnv } from "@/lib/env";
import { HttpError } from "@/lib/http-error";

/** Buat tautan bagikan Mabar Instan baru; tautan lama berhenti berlaku (host atau admin). */
export const POST = route<RouteContext<"/api/sessions/[sessionId]/instant/regenerate">>(async (_request, { params }) => {
  const { sessionId } = await params;
  const groupId = await findSessionGroupId(sessionId);
  if (!groupId) throw new HttpError(404, "Sesi tidak ditemukan.");
  const { member } = await requireMember(groupId);
  const rotated = await rotateInstantToken(sessionId, member.id);
  return Response.json({
    shareUrl: `${publicEnv().siteUrl}/s/${rotated.shareToken}`,
    expiresAt: rotated.expiresAt.toISOString(),
  });
});
