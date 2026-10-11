// Susunan tampilan obrolan grup: pemisah hari (WIB) dan pengelompokan pesan beruntun dari pengirim yang sama.
import { formatDateId, formatTimeId } from "@/lib/format";
import { toJakartaParts } from "@/lib/time";

export interface ChatMessage {
  id: number;
  memberId: string;
  name: string;
  /** null = pesan dihapus */
  body: string | null;
  createdAt: string;
}

export type ChatItem =
  | { type: "day"; key: string; label: string }
  | { type: "message"; key: string; message: ChatMessage; mine: boolean; showName: boolean; time: string };

/** Pesan beruntun dari orang yang sama dalam 5 menit tidak mengulang nama pengirim. */
const GROUP_GAP_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayLabel(day: string, today: string, yesterday: string, at: Date): string {
  if (day === today) return "Hari ini";
  if (day === yesterday) return "Kemarin";
  return formatDateId(at);
}

/** `messages` urut id ↑ (lama → baru); `now` untuk label "Hari ini" / "Kemarin". */
export function chatItems(messages: ChatMessage[], me: string, now: Date): ChatItem[] {
  const today = toJakartaParts(now).date;
  const yesterday = toJakartaParts(new Date(now.getTime() - DAY_MS)).date;
  const items: ChatItem[] = [];
  let prev = null as { day: string; memberId: string; at: number } | null;
  for (const message of messages) {
    const at = new Date(message.createdAt);
    const day = toJakartaParts(at).date;
    if (prev?.day !== day) items.push({ type: "day", key: `d${day}`, label: dayLabel(day, today, yesterday, at) });
    const showName = prev === null || prev.day !== day || prev.memberId !== message.memberId || at.getTime() - prev.at > GROUP_GAP_MS;
    items.push({ type: "message", key: `m${message.id}`, message, mine: message.memberId === me, showName, time: formatTimeId(at) });
    prev = { day, memberId: message.memberId, at: at.getTime() };
  }
  return items;
}

/** Gabungkan pesan baru/lama ke daftar (tanpa duplikat, urut id), lalu terapkan penghapusan. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[], deleted: number[] = []): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  for (const id of deleted) {
    const m = byId.get(id);
    if (m) byId.set(id, { ...m, body: null });
  }
  return [...byId.values()].sort((x, y) => x.id - y.id);
}
