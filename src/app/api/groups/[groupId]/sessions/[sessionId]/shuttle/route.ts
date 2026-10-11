import { readJson, route } from "@/lib/api";
import { setShuttle } from "@/lib/db/sessions";
import { shuttleSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Penghitung kok per slop (admin). Menjadi biaya patungan saat sesi ditutup. */
export const PUT = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/shuttle">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { session } = await adminSession(groupId, sessionId);
  const input = await readJson(request, shuttleSchema);
  await setShuttle(session, input);
  return Response.json(input);
});
