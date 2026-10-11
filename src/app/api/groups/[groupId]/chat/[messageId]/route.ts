import { route } from "@/lib/api";
import { requireMember } from "@/lib/db/authz";
import { deleteMessage } from "@/lib/db/chat";
import { HttpError } from "@/lib/http-error";
import { chatCursor } from "@/lib/validation";

/** Hapus pesan obrolan: pengirimnya sendiri, atau admin grup (moderasi). */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/chat/[messageId]">>(async (_request, { params }) => {
  const { groupId, messageId } = await params;
  const membership = await requireMember(groupId);
  const id = chatCursor(messageId);
  if (id === null) throw new HttpError(404, "Pesan tidak ditemukan.");
  await deleteMessage(groupId, membership, id);
  return new Response(null, { status: 204 });
});
