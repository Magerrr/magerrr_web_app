import { readJson, route } from "@/lib/api";
import { setGuestCookie } from "@/lib/db/authz";
import { joinInstantSession } from "@/lib/db/instant";
import { HttpError } from "@/lib/http-error";
import { instantJoinSchema, isToken } from "@/lib/validation";

/**
 * Gabung Mabar Instan lewat tautan, tanpa akun (Mabar Instan 5/6). Selalu tamu: cookie claim_token menandai perangkat.
 * Expired / penuh dipetakan RPC ke 404 / 409 dengan pesan Indonesia. Belum ada rate limit (sama seperti /api/join).
 */
export const POST = route<RouteContext<"/api/instant/[token]/join">>(async (request, { params }) => {
  const { token } = await params;
  if (!isToken(token)) throw new HttpError(404, "Tautan tidak valid.");

  const { display_name } = await readJson(request, instantJoinSchema);
  const { groupId, sessionId, memberId, claimToken } = await joinInstantSession(token, display_name);
  if (claimToken) await setGuestCookie(groupId, claimToken);
  return Response.json({ groupId, sessionId, memberId }, { status: 201 });
});
