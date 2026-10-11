// Kartu gambar recap (PRD R4) untuk `next/og`: hanya flexbox + gaya inline (Satori).
import { BRAND, MEADOW_HEX as C } from "@/lib/brand";
import type { CardData } from "@/lib/recap-view";

export const CARD_SIZES = {
  "9x16": { width: 1080, height: 1920 },
  "1x1": { width: 1080, height: 1080 },
} as const;
export type CardFormat = keyof typeof CARD_SIZES;

export function RecapCard({ data, format }: { data: CardData; format: CardFormat }) {
  const story = format === "9x16";
  const pad = story ? 88 : 64;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C["cream-paper"],
        color: C["ink-black"],
        padding: pad,
        gap: story ? 48 : 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* = src/app/icon.svg */}
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill={C["fresh-grass"]} />
            <g transform="translate(2.4 2.4) scale(1.133)">
              <path
                d="M4.7 10.3 L5.1 3.8 L9.7 7.2 Q12 6.6 14.3 7.2 L18.9 3.8 L19.3 10.3 Q20.3 13.2 18.9 16 Q16.8 20.1 12 20.1 Q7.2 20.1 5.1 16 Q3.7 13.2 4.7 10.3Z"
                fill={C["ink-black"]}
              />
              <circle cx="9.3" cy="12.4" r="1.6" fill={C["fresh-grass"]} />
              <circle cx="14.7" cy="12.4" r="1.6" fill={C["fresh-grass"]} />
            </g>
          </svg>
          <div style={{ fontSize: 40, letterSpacing: -1.5 }}>{BRAND.name}</div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            padding: "10px 24px",
            borderRadius: 50,
            border: `2px solid ${C["ink-black"]}`,
            background: C["pure-white"],
          }}
        >
          Recap mabar
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: story ? 84 : 64, letterSpacing: -3, lineHeight: 1.05 }}>{data.groupName}</div>
        <div style={{ fontSize: story ? 36 : 30 }}>{data.subtitle}</div>
      </div>

      {data.champion && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: story ? 56 : 40,
            borderRadius: 40,
            background: C["fresh-grass"],
            border: `3px solid ${C["ink-black"]}`,
          }}
        >
          <div style={{ fontSize: story ? 36 : 30 }}>{data.champion.title}</div>
          <div style={{ fontSize: story ? 96 : 72, letterSpacing: -3, lineHeight: 1.05 }}>{data.champion.value}</div>
          <div style={{ fontSize: story ? 34 : 28 }}>{data.champion.detail}</div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {data.stats.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: story ? "100%" : 466,
              padding: story ? "36px 44px" : "24px 32px",
              borderRadius: 32,
              background: C["pure-white"],
              border: `2px solid ${C["ink-black"]}`,
            }}
          >
            <div style={{ fontSize: story ? 30 : 24 }}>{s.label}</div>
            <div style={{ fontSize: story ? 56 : 40, letterSpacing: -2 }}>{s.value}</div>
            {s.detail && story && <div style={{ fontSize: 28 }}>{s.detail}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", marginTop: "auto", fontSize: story ? 28 : 24 }}>Dicatat dengan {BRAND.name}</div>
    </div>
  );
}
