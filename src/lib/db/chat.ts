import "server-only";
import type { ChatMessage } from "@/lib/chat-view";
import { HttpError } from "@/lib/http-error";
import type { Membership } from "./authz";
import { serviceClient } from "./supabase";

const COLUMNS = "id, member_id, body, created_at, deleted_at, members!chat_messages_member_id_fkey(display_name)" as const;
export const CHAT_PAGE = 50;
/** Batas kirim: maksimal 5 pesan per 10 detik per anggota. */
const RATE = { count: 5, windowMs: 10_000 } as const;

type Row = { id: number; member_id: string; body: string; created_at: string; deleted_at: string | null; members: { display_name: string } };

const toMessage = (r: Row): ChatMessage => ({
  id: r.id,
  memberId: r.member_id,
  name: r.members.display_name,
  body: r.deleted_at ? null : r.body,
  createdAt: r.created_at,
});

/** Pesan terbaru (atau sebelum `before`), urut lama → baru. Panggil hanya setelah requireMember. */
export async function recentMessages(groupId: string, before: number | null = null): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  let query = serviceClient().from("chat_messages").select(COLUMNS).eq("group_id", groupId).order("id", { ascending: false }).limit(CHAT_PAGE + 1);
  if (before !== null) query = query.lt("id", before);
  const { data, error } = await query;
  if (error) throw error;
  return { messages: data.slice(0, CHAT_PAGE).reverse().map(toMessage), hasMore: data.length > CHAT_PAGE };
}

/** Pesan baru setelah `after` dan id pesan yang dihapus sejak `since` (polling). */
export async function messagesSince(groupId: string, after: number, since: Date | null): Promise<{ messages: ChatMessage[]; deleted: number[] }> {
  const db = serviceClient();
  const [fresh, removed] = await Promise.all([
    db.from("chat_messages").select(COLUMNS).eq("group_id", groupId).gt("id", after).order("id").limit(200),
    since
      ? db.from("chat_messages").select("id").eq("group_id", groupId).not("deleted_at", "is", null).gt("deleted_at", since.toISOString()).lte("id", after)
      : Promise.resolve({ data: [] as { id: number }[], error: null }),
  ]);
  if (fresh.error) throw fresh.error;
  if (removed.error) throw removed.error;
  return { messages: fresh.data.map(toMessage), deleted: removed.data.map((r) => r.id) };
}

/** Kirim pesan sebagai anggota yang sedang masuk. */
export async function postMessage(groupId: string, memberId: string, body: string): Promise<ChatMessage> {
  const db = serviceClient();
  const { count, error: countError } = await db
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .gt("created_at", new Date(Date.now() - RATE.windowMs).toISOString());
  if (countError) throw countError;
  if ((count ?? 0) >= RATE.count) throw new HttpError(429, "Terlalu cepat. Tunggu beberapa detik lalu kirim lagi.");
  const { data, error } = await db.from("chat_messages").insert({ group_id: groupId, member_id: memberId, body }).select(COLUMNS).single();
  if (error) throw error;
  return toMessage(data);
}

/** Hapus pesan: pengirimnya sendiri atau admin grup. Isi dikosongkan, urutan tetap. */
export async function deleteMessage(groupId: string, actor: Membership, messageId: number): Promise<void> {
  const db = serviceClient();
  const { data: row, error: findError } = await db
    .from("chat_messages")
    .select("member_id, deleted_at")
    .eq("group_id", groupId)
    .eq("id", messageId)
    .maybeSingle();
  if (findError) throw findError;
  if (!row) throw new HttpError(404, "Pesan tidak ditemukan.");
  const isAdmin = actor.member.role === "admin" && actor.via === "account";
  if (row.member_id !== actor.member.id && !isAdmin) throw new HttpError(403, "Kamu hanya bisa menghapus pesanmu sendiri.");
  if (row.deleted_at) return;
  const { error } = await db
    .from("chat_messages")
    .update({ body: "", deleted_at: new Date().toISOString(), deleted_by: actor.member.id })
    .eq("id", messageId)
    .is("deleted_at", null);
  if (error) throw error;
}

/** Tandai sudah dibaca sampai pesan `lastId` (tidak pernah mundur). */
export async function markRead(memberId: string, lastId: number): Promise<void> {
  const { error } = await serviceClient()
    .from("members")
    .update({ chat_read_id: lastId })
    .eq("id", memberId)
    .or(`chat_read_id.is.null,chat_read_id.lt.${lastId}`);
  if (error) throw error;
}

/** Jumlah pesan orang lain yang belum dibaca anggota. */
export async function unreadCount(groupId: string, memberId: string): Promise<number> {
  const db = serviceClient();
  const { data: me, error: meError } = await db.from("members").select("chat_read_id").eq("id", memberId).single();
  if (meError) throw meError;
  const { count, error } = await db
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .neq("member_id", memberId)
    .is("deleted_at", null)
    .gt("id", me.chat_read_id ?? 0);
  if (error) throw error;
  return count ?? 0;
}
