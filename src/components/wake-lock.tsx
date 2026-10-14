"use client";

import { useEffect, useState } from "react";

/** Layar tetap menyala selama papan skor terbuka (Wake Lock API bila tersedia). */
export function WakeLock() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (disposed) return void lock.release();
        setActive(true);
        lock.addEventListener("release", () => setActive(false));
      } catch {
        setActive(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
  return active ? <p className="text-caption">Layar tetap menyala selama halaman ini terbuka.</p> : null;
}
