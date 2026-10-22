import { readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/db/authz";
import { createInstantSession } from "@/lib/db/sessions";
import { publicEnv } from "@/lib/env";
import { instantSessionSchema } from "@/lib/validation";

/** Buat sesi Mabar Instan (perlu login); host jadi admin grup tersembunyinya. */
export const POST = route(async (request) => {
  const user = await requireUser();
  const input = await readJson(request, instantSessionSchema);
  const created = await createInstantSession(user.id, input);
  return Response.json(
    {
      groupId: created.groupId,
      sessionId: created.sessionId,
      shareUrl: `${publicEnv().siteUrl}/s/${created.shareToken}`,
    },
    { status: 201 },
  );
});
