import { readJson, route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { loadKiko, saveKikoOutfit } from "@/lib/db/kiko";
import { loadGroupMatches } from "@/lib/db/matches";
import { kikoOutfitSchema } from "@/lib/validation";

/** Kostum Kiko milik sendiri (akun atau tamu). `{outfit: null}` = kembali otomatis sesuai level. */
export const PUT = route<RouteContext<"/api/groups/[groupId]/kiko">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireMember(groupId);
  const { outfit } = await readJson(request, kikoOutfitSchema);
  const state = await loadKiko(groupId, member.id, await loadGroupMatches(groupId), new Date());
  await saveKikoOutfit(groupId, member.id, outfit, state);
  return Response.json({ outfit });
});
