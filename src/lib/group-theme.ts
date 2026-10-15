// Warna tema grup (MAGERRR-8): hanya preset dari palet Meadow agar teks ink-black di atasnya selalu terbaca
// (kontras >= 4.5:1, diuji di group-theme.test.ts). Kelas Tailwind ditulis utuh agar ikut ter-generate.

export const GROUP_THEMES = ["grass", "sky", "coral", "sunshine", "sand"] as const;
export type GroupTheme = (typeof GROUP_THEMES)[number];

export const THEME_LABEL: Record<GroupTheme, string> = {
  grass: "Hijau",
  sky: "Biru",
  coral: "Koral",
  sunshine: "Kuning",
  sand: "Pasir",
};

/** Isi latar (teks di atasnya selalu ink-black). */
export const THEME_BG: Record<GroupTheme, string> = {
  grass: "bg-fresh-grass",
  sky: "bg-sky-pop",
  coral: "bg-coral-pop",
  sunshine: "bg-sunshine-pop",
  sand: "bg-sandstone",
};

/** = token Meadow di globals.css (diuji di group-theme.test.ts). */
export const THEME_HEX: Record<GroupTheme, string> = {
  grass: "#8ed462",
  sky: "#2ba0ff",
  coral: "#ff705d",
  sunshine: "#f5e211",
  sand: "#e0dbce",
};

export const isGroupTheme = (value: string): value is GroupTheme => (GROUP_THEMES as readonly string[]).includes(value);
