"use client";

import { useEffect } from "react";

/** Catat pembukaan link publik sesi (metrik PRD §4); server menyaring host dan menghitung unik per perangkat. */
export function TrackOpen({ token }: { token: string }) {
  useEffect(() => {
    fetch("/api/events/buka", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => {});
  }, [token]);
  return null;
}
