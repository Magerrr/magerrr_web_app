"use client";

import { useSyncExternalStore } from "react";
import { WakeLock } from "@/components/wake-lock";

const subscribe = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};

/** Tombol layar penuh (Fullscreen API bila tersedia) + layar tetap menyala untuk papan di samping lapangan. */
export function DisplayTools() {
  // Server: tanpa tombol (dukungan baru diketahui di peramban) agar tidak ada tombol mati.
  const supported = useSyncExternalStore(subscribe, () => document.fullscreenEnabled, () => false);
  const full = useSyncExternalStore(subscribe, () => document.fullscreenElement !== null, () => false);

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Ditolak peramban (mis. iframe): biarkan, pengguna masih bisa memakai F11 / menu peramban.
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {supported && (
        <button
          type="button"
          onClick={() => void toggle()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-cream-paper px-5 text-ui transition-colors hover:bg-fresh-grass hover:text-ink-black"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
          {full ? "Keluar layar penuh" : "Layar penuh"}
        </button>
      )}
      <WakeLock />
    </div>
  );
}
