import { readJson, route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { markRead, messagesSince, postMessage, recentMessages } from "@/lib/db/chat";
import { chatCursor, chatMessageSchema } from "@/lib/validation";

/**
 * Obrolan grup (hanya anggota). `?after=<id>&since=<iso>` → pesan baru + yang dihapus sejak `since`
 * (polling); `?before=<id>` → halaman pesan lama. Polling menandai pesan sampai yang terbaru sudah dibaca.
 */
export const GET = route<RouteContext<"/api/groups/[groupId]/chat">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireMember(groupId);
  const url = new URL(request.url);
  const now = new Date();
  const before = chatCursor(url.searchParams.get("before"));
  if (before !== null) return Response.json({ ...(await recentMessages(groupId, before)), now: now.toISOString() });

  const after = chatCursor(url.searchParams.get("after")) ?? 0;
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? new Date(sinceParam) : null;
  const result = await messagesSince(groupId, after, since);
  const read = result.messages.at(-1)?.id ?? after;
  if (read > 0) await markRead(member.id, read);
  return Response.json({ ...result, now: now.toISOString() }, { headers: { "cache-control": "no-store" } });
});

export const POST = route<RouteContext<"/api/groups/[groupId]/chat">>(async (request, { params }) => {
  const { groupId } = await params;
  const { member } = await requireMember(groupId);
  const { body } = await readJson(request, chatMessageSchema);
  const message = await postMessage(groupId, member.id, body);
  await markRead(member.id, message.id);
  return Response.json(message, { status: 201 });
});
