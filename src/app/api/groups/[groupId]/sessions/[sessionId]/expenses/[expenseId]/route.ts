import { readJson, route } from "@/lib/api";
import { deleteExpense, saveExpense } from "@/lib/db/bill";
import { getGroup } from "@/lib/db/groups";
import { HttpError } from "@/lib/http-error";
import { expenseSchema, isUuid } from "@/lib/validation";
import { adminSession } from "../../load";

type Context = RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/expenses/[expenseId]">;

async function load({ params }: Context) {
  const { groupId, sessionId, expenseId } = await params;
  if (!isUuid(expenseId)) throw new HttpError(404, "Biaya tidak ditemukan.");
  const { membership, session } = await adminSession(groupId, sessionId);
  return { group: await getGroup(groupId), session, actorId: membership.member.id, expenseId };
}

/** Ubah biaya; status lunas dipertahankan bila nominal transfer tidak berubah. */
export const PATCH = route<Context>(async (request, context) => {
  const { group, session, actorId, expenseId } = await load(context);
  const input = await readJson(request, expenseSchema);
  return Response.json(await saveExpense(group, session, actorId, input, expenseId));
});

export const DELETE = route<Context>(async (_request, context) => {
  const { group, session, actorId, expenseId } = await load(context);
  return Response.json(await deleteExpense(group, session, actorId, expenseId));
});
