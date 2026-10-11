import { readJson, route } from "@/lib/api";
import { saveExpense } from "@/lib/db/bill";
import { getGroup } from "@/lib/db/groups";
import { expenseSchema } from "@/lib/validation";
import { adminSession } from "../load";

/** Tambah biaya (PRD P1–P2); tagihan dihitung ulang dan tercatat di audit_log. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/expenses">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  const input = await readJson(request, expenseSchema);
  const result = await saveExpense(await getGroup(groupId), session, membership.member.id, input);
  return Response.json(result, { status: 201 });
});
