// Pengirim event bagikan dari klien (tidak menunggu, gagal diam-diam).
import type { ShareChannel } from "./analytics-core";

export function trackShare(event: "bill_shared" | "recap_shared", token: string, channel: ShareChannel): void {
  const body = new Blob([JSON.stringify({ event, token, channel })], { type: "application/json" });
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/events", body)) return;
  fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}
