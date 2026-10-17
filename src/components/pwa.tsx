"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Daftarkan service worker (hanya build produksi; di dev cache membingungkan HMR). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Tanpa service worker aplikasi tetap jalan (hanya tanpa dukungan offline).
    });
  }, []);
  return null;
}

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Banner saat perangkat offline (BUILD_PLAN Fase 8: minimal banner "offline"). */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 border-b-1 border-ink-black bg-sunshine-pop px-5 py-3 text-center text-small text-ink-black">
      Kamu sedang offline. Data yang tampil mungkin bukan yang terbaru, dan perubahan belum bisa disimpan.
    </div>
  );
}
