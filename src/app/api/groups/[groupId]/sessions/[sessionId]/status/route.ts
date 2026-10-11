import { readJson, route } from "@/lib/api";
import { addShuttleExpense } from "@/lib/db/bill";
import { getGroup } from "@/lib/db/groups";
import { setStatus } from "@/lib/db/sessions";
import { sessionStatusSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Mulai (planned → running) atau tutup (running → finished) sesi (admin). */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/status">>(
  async (request, { params }) => {
    const { groupId, sessionId } = await params;
    const { membership, session } = await adminSession(groupId, sessionId);
    const { status } = await readJson(request, sessionStatusSchema);
    // Kok terpakai masuk patungan sebelum sesi dikunci (design/README #7). Versi tagihan mencegah dobel
    // bila dua admin menutup bersamaan.
    if (status === "finished" && session.status === "running") {
      await addShuttleExpense(await getGroup(groupId), session, membership.member.id);
    }
    await setStatus(session, status);
    return Response.json({ status });
  },
);
