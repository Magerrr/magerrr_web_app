"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cx } from "./button-class";

/*
 * Notifikasi singkat (toast) global untuk hasil panggilan API: "Tersimpan.", pesan error dari server, dsb.
 * Panggil `toast(teks)` / `toast.error(teks)` dari komponen klien mana pun; `<Toaster />` dipasang sekali di layout akar,
 * jadi toast tetap terlihat walau halaman berpindah (router.push) setelah aksi berhasil.
 */
type Tone = "info" | "success" | "error";
type Item = { id: number; tone: Tone; text: string };

const DURATION_MS: Record<Tone, number> = { info: 3500, success: 5000, error: 6000 };
/** Pesan panjang (mis. daftar status bayar yang direset) diberi waktu baca lebih lama. */
const MS_PER_CHAR = 60;
const MAX_DURATION_MS = 12000;
const MAX_VISIBLE = 3;

let items: Item[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(text: string, tone: Tone) {
  // Pesan sama yang masih tampil diganti, tidak ditumpuk (mis. tombol ditekan berulang).
  items = [...items.filter((item) => item.text !== text), { id: nextId++, tone, text }].slice(-MAX_VISIBLE);
  emit();
}

export function toast(text: string, tone: Tone = "info") {
  push(text, tone);
}
toast.error = (text: string) => push(text, "error");

toast.success = (text: string) => push(text, "success");

const EMPTY: Item[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      data-testid="toaster"
    >
      {list.map((item) => (
        <ToastItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToastItem({ item }: { item: Item }) {
  useEffect(() => {
    const ms = Math.min(MAX_DURATION_MS, Math.max(DURATION_MS[item.tone], item.text.length * MS_PER_CHAR));
    const timer = window.setTimeout(() => dismiss(item.id), ms);
    return () => window.clearTimeout(timer);
  }, [item]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      data-testid="toast"
      data-tone={item.tone}
      className={cx(
         item.tone === "success" ? "bg-fresh-grass" : item.tone === "error" ? "bg-coral-pop" : "bg-pure-white",
        "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border py-3 pr-2 pl-4 text-small text-ink-black",
        "motion-safe:animate-[toast-in_160ms_ease-out]",
        item.tone === "error" ? "border-coral-pop shadow-[0_3px_0_0_var(--color-coral-pop)]" : "border-ink-black shadow-[0_3px_0_0_var(--color-fresh-grass)]",
      )}
    >
      <p className="flex-1 py-1">{item.text}</p>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Tutup notifikasi"
        className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-cream-paper"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Toast dari halaman server: pesan hasil redirect yang dibawa lewat query (`?error=…`, `?email=…`). Ditampilkan sekali,
 * lalu parameternya dihapus dari URL agar tidak muncul lagi saat halaman dimuat ulang.
 */
export function FlashToast({ text, tone = "info", param }: { text: string; tone?: Tone; param: string }) {
  useEffect(() => {
    push(text, tone);
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, "", url);
  }, [text, tone, param]);
  return null;
}
