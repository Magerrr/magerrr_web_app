"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "@/components/toast";
import { Button, bleedX } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { chatItems, mergeMessages, type ChatMessage } from "@/lib/chat-view";
import { CHAT_MAX_LENGTH } from "@/lib/validation";

const POLL_MS = 3000;

/**
 * Obrolan grup: pesan baru diambil tiap 3 detik selama tab terlihat & online (tanpa menumpuk permintaan),
 * termasuk pesan yang dihapus sejak polling sebelumnya. Pesan sendiri / semua pesan (admin) bisa dihapus.
 */
export function ChatRoom({
  groupId,
  me,
  isAdmin,
  initial,
  initialHasMore,
  serverNow,
}: {
  groupId: string;
  me: string;
  isAdmin: boolean;
  initial: ChatMessage[];
  initialHasMore: boolean;
  serverNow: string;
}) {
  const url = `/api/groups/${groupId}/chat`;
  const [messages, setMessages] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [now, setNow] = useState(serverNow);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const state = useRef({ lastId: initial.at(-1)?.id ?? 0, since: serverNow, inflight: false, stickToBottom: true });
  const listEnd = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => listEnd.current?.scrollIntoView({ block: "end" }), []);

  const poll = useCallback(async () => {
    const s = state.current;
    if (s.inflight || document.visibilityState !== "visible" || !navigator.onLine) return;
    s.inflight = true;
    try {
      const response = await fetch(`${url}?after=${s.lastId}&since=${encodeURIComponent(s.since)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data: { messages: ChatMessage[]; deleted: number[]; now: string } = await response.json();
      s.since = data.now;
      s.lastId = Math.max(s.lastId, data.messages.at(-1)?.id ?? 0);
      s.stickToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
      setNow(data.now);
      if (data.messages.length > 0 || data.deleted.length > 0) setMessages((m) => mergeMessages(m, data.messages, data.deleted));
    } catch {
      // jaringan putus: coba lagi di tick berikutnya
    } finally {
      s.inflight = false;
    }
  }, [url]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [poll]);

  // Ikuti pesan terbaru bila pengguna sedang di bawah (tidak mengganggu saat membaca pesan lama).
  useLayoutEffect(() => {
    if (state.current.stickToBottom) scrollToEnd();
  }, [messages, scrollToEnd]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const result = await sendJson<ChatMessage>(url, "POST", { body });
    setSending(false);
    if (!result.ok) return toast.error(result.error);
    setDraft("");
    state.current.stickToBottom = true;
    state.current.lastId = Math.max(state.current.lastId, result.data.id);
    setMessages((m) => mergeMessages(m, [result.data]));
  }

  async function remove(id: number) {
    const result = await sendJson(`${url}/${id}`, "DELETE");
    if (!result.ok) return toast.error(result.error);
    toast("Pesan dihapus.");
    setSelected(null);
    state.current.stickToBottom = false;
    setMessages((m) => mergeMessages(m, [], [id]));
  }

  async function loadOlder() {
    const oldest = messages[0]?.id;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const response = await fetch(`${url}?before=${oldest}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: { messages: ChatMessage[]; hasMore: boolean } = await response.json();
      state.current.stickToBottom = false;
      setMessages((m) => mergeMessages(m, data.messages));
      setHasMore(data.hasMore);
    } catch {
      toast.error("Gagal memuat pesan lama. Coba lagi.");
    } finally {
      setLoadingOlder(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Desktop: Enter kirim, Shift+Enter baris baru. Layar sentuh: Enter tetap baris baru.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (window.matchMedia("(pointer: coarse)").matches && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    void send();
  }

  const items = chatItems(messages, me, new Date(now));

  return (
    <>
      <section aria-label="Pesan" className="flex flex-col gap-2">
        {hasMore && (
          <Button variant="secondary" className="self-center" onClick={loadOlder} loading={loadingOlder}>
            Muat pesan sebelumnya
          </Button>
        )}
        {messages.length === 0 ? (
          <p className="py-8 text-center text-ui">Belum ada pesan. Sapa anggota grupmu.</p>
        ) : (
          <div role="log" aria-live="polite" aria-relevant="additions" data-testid="chat-log">
            <ol className="flex flex-col gap-1">
              {items.map((item) =>
                item.type === "day" ? (
                  <li key={item.key} className="my-2 self-center rounded-full border border-ink-black bg-pure-white px-3 py-1 text-caption">
                    {item.label}
                  </li>
                ) : (
                  <li key={item.key} className={`flex flex-col gap-1 ${item.mine ? "items-end" : "items-start"} ${item.showName ? "mt-2" : ""}`} data-testid="chat-message">
                    {item.showName && !item.mine && <span className="px-1 text-caption font-medium">{item.message.name}</span>}
                    <MessageBubble
                      item={item}
                      canDelete={item.message.body !== null && (item.mine || isAdmin)}
                      selected={selected === item.message.id}
                      onSelect={() => setSelected((s) => (s === item.message.id ? null : item.message.id))}
                    />
                    {selected === item.message.id && (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => remove(item.message.id)}>
                          Hapus pesan
                        </Button>
                        <Button variant="secondary" onClick={() => setSelected(null)}>
                          Batal
                        </Button>
                      </div>
                    )}
                  </li>
                ),
              )}
            </ol>
          </div>
        )}
        <div ref={listEnd} />
      </section>

      <form
        className={`sticky bottom-0 ${bleedX} mt-auto flex flex-col gap-2 border-t border-ink-black bg-cream-paper pt-3 pb-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Tulis pesan
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(5, Math.max(1, draft.split("\n").length))}
            maxLength={CHAT_MAX_LENGTH}
            placeholder="Tulis pesan…"
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-2xl field-sizing-content border-1 border-ink-black bg-pure-white px-4 py-2.5 text-ui text-ink-black placeholder:text-ink-black"
          />
          <Button type="submit" variant="accent" loading={sending} disabled={draft.trim() === ""}>
            Kirim
          </Button>
        </div>
        {draft.length > CHAT_MAX_LENGTH - 100 && (
          <p className="text-caption" aria-live="polite">
            {draft.length}/{CHAT_MAX_LENGTH} karakter
          </p>
        )}
      </form>
    </>
  );
}

function MessageBubble({
  item,
  canDelete,
  selected,
  onSelect,
}: {
  item: Extract<ReturnType<typeof chatItems>[number], { type: "message" }>;
  canDelete: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { message, mine, time } = item;
  const deleted = message.body === null;
  const tone = deleted
    ? "border-sandstone bg-sandstone"
    : mine
      ? "border-ink-black bg-ink-black text-cream-paper rounded-br-sm"
      : "border-ink-black bg-pure-white rounded-bl-sm";
  const content = (
    <>
      <span className="sr-only">{mine ? "Kamu" : message.name}, </span>
      <span className={`whitespace-pre-wrap break-words ${deleted ? "italic" : ""}`}>{deleted ? "Pesan dihapus" : message.body}</span>
      <span className={`mt-1 block text-caption ${mine ? "text-right" : ""}`}>{time}</span>
    </>
  );
  const className = `max-w-[85%] rounded-2xl border px-4 py-2 text-left text-ui sm:max-w-[70%] ${tone}`;
  if (!canDelete) return <div className={className}>{content}</div>;
  return (
    <button type="button" onClick={onSelect} aria-expanded={selected} className={`${className} min-h-11 min-w-11`}>
      {content}
    </button>
  );
}
