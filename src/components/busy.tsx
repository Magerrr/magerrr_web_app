"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Spinner } from "./spinner";

/*
 * Overlay "Memproses…" global. Komponen yang sedang menunggu server memanggil `useBusy(true)`;
 * overlay baru muncul bila proses berjalan > SHOW_AFTER_MS, sehingga aksi cepat cukup ditandai spinner di tombol.
 */
const SHOW_AFTER_MS = 400;

let active = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Tandai komponen ini sedang memproses selama `busy` bernilai true. */
export function useBusy(busy: boolean) {
  useEffect(() => {
    if (!busy) return;
    active += 1;
    emit();
    return () => {
      active -= 1;
      emit();
    };
  }, [busy]);
}

export function BusyOverlay() {
  const busy = useSyncExternalStore(
    subscribe,
    () => active > 0,
    () => false,
  );
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      setShown(false);
    };
  }, [busy]);

  if (!busy || !shown) return null;
  return (
    <div className="fixed inset-0 z-50 grid cursor-wait place-items-center bg-ink-black/25 p-5" data-testid="busy-overlay">
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-5 py-4 text-ui shadow-[0_3px_0_0_var(--color-fresh-grass)]">
        <Spinner className="size-5" />
        Memproses…
      </div>
    </div>
  );
}
