"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

/**
 * Live scoreboard (SC8): muat ulang data server tiap `seconds` detik selama tab terlihat & online.
 * Tidak menumpuk permintaan: lewati tick bila refresh sebelumnya belum selesai.
 */
export function AutoRefresh({ seconds = 3 }: { seconds?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || pendingRef.current) return;
      startTransition(() => router.refresh());
    };
    const timer = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);

  return <p className="text-caption">Diperbarui otomatis tiap {seconds} detik.</p>;
}
