// Maskot Kiko (ilustrasi kucing atlet). Digambar ulang dari desain Kiko.dc.html sebagai komponen React.
// Warna ilustrasi (bulu, aksesori) bukan token UI Meadow; semuanya dikumpulkan di sini, tidak tersebar.
// Animasi lewat CSS (globals.css, kelas kiko-*) dan mati bila pengguna memilih reduced motion.
import type { CSSProperties } from "react";
import type { KikoLevel, KikoMood, KikoOutfit } from "@/lib/core/mascot";

export const KIKO_FUR_COLORS: Record<KikoOutfit["fur"], { fur: string; stripe: string; belly: string; label: string }> = {
  oranye: { fur: "#f6a04d", stripe: "#d9782a", belly: "#fff4e3", label: "Oranye" },
  abu: { fur: "#a9b1bc", stripe: "#7d8794", belly: "#f4f1ea", label: "Abu" },
  krem: { fur: "#f4f1ea", stripe: "#c9bfa9", belly: "#ffffff", label: "Krem" },
  hitam: { fur: "#3a3f4b", stripe: "#23262e", belly: "#e0dbce", label: "Hitam" },
};

export const KIKO_JERSEY_COLORS: Record<Exclude<KikoOutfit["jersey"], "none">, { fill: string; number: string; label: string }> = {
  navy: { fill: "#334155", number: "#ffffff", label: "Navy" },
  hijau: { fill: "#8ed462", number: "#2c2e2a", label: "Hijau" },
  koral: { fill: "#ff705d", number: "#2c2e2a", label: "Koral" },
  hitam: { fill: "#2c2e2a", number: "#ffffff", label: "Hitam" },
};

const INK = "#2c2e2a";
const ACCENT = "#ff6a2b"; // ikat kepala & topi
const CAPE = "#e5484d";
const GOLD = "#ffc21a";
const PINK = "#ff8a93";

type Pose = KikoMood | "jump";

const MOTION: Record<Pose, { bounce: string; dur: string; tail: string; wag: string }> = {
  sleepy: { bounce: "2px", dur: "3s", tail: "3s", wag: "3deg" },
  happy: { bounce: "-5px", dur: "1.1s", tail: "1.2s", wag: "11deg" },
  fire: { bounce: "-9px", dur: "0.55s", tail: "0.5s", wag: "11deg" },
  jump: { bounce: "-28px", dur: "0.45s", tail: "0.5s", wag: "11deg" },
};

const SCALE: Record<KikoLevel, number> = { 1: 0.7, 2: 0.82, 3: 0.92, 4: 1 };

export interface KikoProps {
  level: KikoLevel;
  mood: KikoMood;
  outfit: KikoOutfit;
  size?: number;
  /** animasi lompat sesaat (mis. setelah dielus) */
  jumping?: boolean;
  /** siluet gelap (pratinjau level berikutnya yang belum terbuka) */
  silhouette?: boolean;
  /** null = dekoratif (aria-hidden); teks di sekitarnya sudah menjelaskan */
  label?: string | null;
}

export function Kiko({ level, mood, outfit, size = 200, jumping = false, silhouette = false, label = null }: KikoProps) {
  const palette = KIKO_FUR_COLORS[outfit.fur];
  const fur = silhouette ? INK : palette.fur;
  const stripe = silhouette ? INK : palette.stripe;
  const belly = silhouette ? INK : palette.belly;
  const jersey = outfit.jersey === "none" ? null : KIKO_JERSEY_COLORS[outfit.jersey];
  const pose: Pose = jumping ? "jump" : mood;
  const motion = MOTION[pose];
  const s = SCALE[level];
  const kitten = level === 1;
  const eyeRy = kitten ? 10 : 8;
  const eyeRx = kitten ? 8 : 6.5;
  const style = {
    "--kiko-bounce": motion.bounce,
    "--kiko-dur": motion.dur,
    "--kiko-tail": motion.tail,
    "--kiko-wag": motion.wag,
  } as CSSProperties;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" className="kiko block overflow-visible" style={style} {...a11y}>
      <ellipse cx="100" cy="193" rx={Math.round(46 * s)} ry="6" fill={INK} fillOpacity="0.16" />
      <g transform={`translate(${(100 * (1 - s)).toFixed(1)} ${(194 * (1 - s)).toFixed(1)}) scale(${s})`}>
        <g className="kiko-body">
          {mood === "fire" && !silhouette && (
            <g>
              <path className="kiko-flicker" d="M52 186 C30 150 50 120 62 104 C62 126 74 128 76 116 C88 136 70 160 52 186 Z" fill={ACCENT} />
              <path className="kiko-flicker kiko-flicker-late" d="M148 186 C170 150 150 120 138 104 C138 126 126 128 124 116 C112 136 130 160 148 186 Z" fill={ACCENT} />
              <path d="M60 184 C48 162 58 146 66 136 C68 150 76 152 78 144 C82 160 72 172 60 184 Z" fill="#ffc93c" />
              <path d="M140 184 C152 162 142 146 134 136 C132 150 124 152 122 144 C118 160 128 172 140 184 Z" fill="#ffc93c" />
            </g>
          )}
          {level === 4 && <path d="M70 128 Q100 118 130 128 L150 186 Q100 198 50 186 Z" fill={silhouette ? INK : CAPE} />}
          <g className="kiko-tail">
            <path d="M132 172 C168 174 178 140 160 120" stroke={fur} strokeWidth="12" strokeLinecap="round" />
            <path d="M156 127 l8 -6" stroke={stripe} strokeWidth="5" strokeLinecap="round" />
          </g>
          <ellipse cx="100" cy="152" rx="38" ry="33" fill={fur} />
          <ellipse cx="100" cy="158" rx="22" ry="21" fill={belly} />
          {jersey && (
            <g>
              <path d="M63 140 Q100 120 137 140 L135 172 Q100 185 65 172 Z" fill={silhouette ? INK : jersey.fill} />
              <path d="M90 127 L100 137 L110 127" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {!silhouette && (
                <text aria-hidden="true" x="100" y="167" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="22" fill={jersey.number}>
                  {level}
                </text>
              )}
            </g>
          )}
          <ellipse cx="84" cy="184" rx="13" ry="8" fill={fur} />
          <ellipse cx="116" cy="184" rx="13" ry="8" fill={fur} />
          {!silhouette && (
            <g fill="#ff9da4">
              <circle cx="80" cy="186" r="2" />
              <circle cx="88" cy="186" r="2" />
              <circle cx="112" cy="186" r="2" />
              <circle cx="120" cy="186" r="2" />
            </g>
          )}
          <ellipse cx="64" cy="152" rx="9" ry="13" transform="rotate(22 64 152)" fill={fur} />
          {outfit.acc === "racket" ? (
            <g>
              <path d="M146 120 L162 92" stroke={INK} strokeWidth="5" strokeLinecap="round" />
              <ellipse cx="168" cy="78" rx="12" ry="15" transform="rotate(25 168 78)" fill="#ffffff" fillOpacity="0.85" stroke={INK} strokeWidth="4" />
              <path d="M162 70l12 16M170 66l-6 22M158 78l18 0" stroke={INK} strokeOpacity="0.35" strokeWidth="1.5" />
              <ellipse cx="140" cy="130" rx="9" ry="13" transform="rotate(-35 140 130)" fill={fur} />
            </g>
          ) : (
            <ellipse cx="136" cy="152" rx="9" ry="13" transform="rotate(-22 136 152)" fill={fur} />
          )}
          {outfit.acc === "ball" && (
            <g>
              <circle cx="156" cy="180" r="12" fill="#ffffff" stroke={INK} strokeWidth="2.5" />
              <path d="M150 176l6-4 6 4-2 7h-8z" fill={INK} />
            </g>
          )}
          <path d="M60 54 L56 16 L90 40 Z" fill={fur} />
          <path d="M140 54 L144 16 L110 40 Z" fill={fur} />
          {!silhouette && (
            <>
              <path d="M64 46 L62 26 L80 40 Z" fill="#ffb4a8" />
              <path d="M136 46 L138 26 L120 40 Z" fill="#ffb4a8" />
            </>
          )}
          <ellipse cx="100" cy="80" rx={kitten ? 54 : 50} ry={kitten ? 48 : 44} fill={fur} />
          <path d="M92 40 l2 12M100 38 v13M108 40 l-2 12" stroke={stripe} strokeWidth="4" strokeLinecap="round" />
          <path d="M50 82 l-10 -2M50 88 l-10 2M150 82 l10 -2M150 88 l10 2" stroke={stripe} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="100" cy="95" rx="21" ry="13" fill={belly} />
          {!silhouette && (
            <>
              <circle cx="68" cy="94" r="7" fill={PINK} fillOpacity="0.55" />
              <circle cx="132" cy="94" r="7" fill={PINK} fillOpacity="0.55" />
            </>
          )}
          {!silhouette &&
            (mood === "sleepy" && !jumping ? (
              <g>
                <path d="M71 79 q9 6 18 0M111 79 q9 6 18 0" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
                <text aria-hidden="true" className="kiko-zzz" x="150" y="44" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="16" fill={INK}>
                  z
                </text>
                <text aria-hidden="true" className="kiko-zzz kiko-zzz-late" x="162" y="30" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="12" fill={INK}>
                  z
                </text>
              </g>
            ) : (
              <g fill={INK}>
                <ellipse className="kiko-eye" cx="80" cy="78" rx={eyeRx} ry={eyeRy} />
                <ellipse className="kiko-eye" cx="120" cy="78" rx={eyeRx} ry={eyeRy} />
                <circle cx="83" cy="74" r="2.4" fill="#ffffff" />
                <circle cx="123" cy="74" r="2.4" fill="#ffffff" />
              </g>
            ))}
          {mood === "fire" && !silhouette && <path d="M68 64 l20 6M132 64 l-20 6" stroke={INK} strokeWidth="4" strokeLinecap="round" />}
          {outfit.acc === "shades" && !silhouette && (
            <g>
              <rect x="66" y="69" width="28" height="16" rx="7" fill={INK} />
              <rect x="106" y="69" width="28" height="16" rx="7" fill={INK} />
              <path d="M94 75h12M66 74l-12-4M134 74l12-4" stroke={INK} strokeWidth="3" strokeLinecap="round" />
              <path d="M72 76l6-3M112 76l6-3" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
          {!silhouette && (
            <>
              <path d="M96 89 h8 l-4 5 z" fill="#ff7e86" stroke="#ff7e86" strokeWidth="2" strokeLinejoin="round" />
              <path d="M92 97 q4 5 8 0 q4 5 8 0" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
          {outfit.hat === "band" && (
            <g fill={silhouette ? INK : ACCENT}>
              <path d="M51 62 Q100 40 149 62 L148 72 Q100 51 52 72 Z" />
              <path d="M51 66 L36 58 L40 72 Z M51 69 L38 78 L48 82 Z" />
            </g>
          )}
          {outfit.hat === "cap" && (
            <g>
              <path d="M56 60 Q100 14 144 60 Z" fill={silhouette ? INK : ACCENT} />
              <path d="M100 60 Q140 52 172 64 Q140 70 100 66 Z" fill={INK} />
              <circle cx="100" cy="30" r="3" fill={INK} />
            </g>
          )}
          {outfit.hat === "crown" && (
            <g>
              <path d="M76 44 L80 18 L90 32 L100 12 L110 32 L120 18 L124 44 Z" fill={silhouette ? INK : GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
              {!silhouette && (
                <>
                  <circle cx="100" cy="34" r="3.5" fill={CAPE} />
                  <path className="kiko-flicker" d="M132 20 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 z" fill="#ffffff" />
                </>
              )}
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
