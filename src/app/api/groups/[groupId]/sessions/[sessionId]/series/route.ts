import { readJson, route } from "@/lib/api";
import { createSeries, initialCosts } from "@/lib/db/session-series";
import { HttpError } from "@/lib/http-error";
import { toJakartaParts } from "@/lib/time";
import { repeatSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Jadikan sesi ini berulang (admin); biaya default diambil dari biaya awal sesi. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/series">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  if (session.status === "finished") throw new HttpError(422, "Sesi sudah selesai. Ulangi dari sesi yang belum selesai.");
  const repeat = await readJson(request, repeatSchema);
  const id = await createSeries(session, membership.member.id, repeat, initialCosts(session), toJakartaParts(new Date()).date);
  return Response.json({ id }, { status: 201 });
});
