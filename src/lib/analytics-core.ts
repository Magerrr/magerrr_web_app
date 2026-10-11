// Event analytics dasar (BUILD_PLAN Fase 8). Tanpa nama/email: id anggota & grup (UUID) saja.
export const ANALYTICS_EVENTS = ["session_created", "match_completed", "bill_shared", "recap_shared"] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const SHARE_CHANNELS = ["whatsapp", "copy_text", "copy_link", "web_share", "download"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export type AnalyticsProps = Record<string, string | number | boolean | null>;

/** Body untuk endpoint capture PostHog (`POST {host}/i/v0/e/`). */
export function posthogPayload(apiKey: string, event: AnalyticsEvent, distinctId: string, props: AnalyticsProps) {
  return {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    // Tanpa profil orang: cukup hitungan event per grup.
    properties: { ...props, $process_person_profile: false },
  };
}
