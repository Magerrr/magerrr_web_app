import { readJson, route } from "@/lib/api";
import { setRecapPublic } from "@/lib/db/sessions";
import { recapSettingsSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Aktifkan / matikan halaman recap publik (PRD R5). */
export const PATCH = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/recap">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { session } = await adminSession(groupId, sessionId);
  const { public: value } = await readJson(request, recapSettingsSchema);
  await setRecapPublic(session, value);
  return Response.json({ public: value });
});
