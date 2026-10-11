import "server-only";
import { after } from "next/server";
import { posthogPayload, type AnalyticsEvent, type AnalyticsProps } from "./analytics-core";

/**
 * Catat event tanpa memperlambat respons. Dengan `POSTHOG_KEY` terkirim ke PostHog;
 * tanpa itu hanya dicatat di log server saat pengembangan (stub yang bisa diganti).
 */
export function track(event: AnalyticsEvent, distinctId: string, props: AnalyticsProps = {}): void {
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production" || process.env.ANALYTICS_DEBUG === "1") {
      console.info(`[analytics] ${event}`, JSON.stringify({ distinctId, ...props }));
    }
    return;
  }
  const host = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
  after(async () => {
    try {
      await fetch(`${host}/i/v0/e/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(posthogPayload(key, event, distinctId, props)),
        signal: AbortSignal.timeout(3000),
      });
    } catch (error) {
      console.error("[analytics] gagal mengirim", event, error);
    }
  });
}
