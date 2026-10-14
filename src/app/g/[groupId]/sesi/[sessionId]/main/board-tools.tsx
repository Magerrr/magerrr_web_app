"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useBusy } from "@/components/busy";
import { Spinner, textButtonClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

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

export function VoidButton({ url }: { url: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBusy(pending);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={async () => {
          if (!window.confirm("Batalkan match ini? Match tidak dihitung di klasemen.")) return;
          setPending(true);
          const result = await sendJson(url, "POST");
          setPending(false);
          if (!result.ok) return setError(result.error);
          router.refresh();
        }}
        className={textButtonClass}
      >
        {pending && <Spinner />}
        Batalkan
      </button>
      {error && <span role="alert" className="text-small">{error}</span>}
    </>
  );
}
