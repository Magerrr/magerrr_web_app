// Identitas aplikasi untuk metadata & manifest. Warna di sini hanya untuk tempat yang tidak bisa
// membaca CSS variable (manifest, <meta name="theme-color">); komponen memakai token di globals.css.
export const BRAND = {
  name: "Magerrr",
  description:
    "Mabar badminton dalam satu tempat: atur sesi, catat skor, klasemen, patungan, dan recap.",
  // = token Meadow cream-paper (diuji di meadow-tokens.test.ts)
  themeColor: "#f5f1e4",
} as const;

/** Hex token Meadow untuk gambar `next/og` (Satori tidak membaca CSS variable). Diuji di meadow-tokens.test.ts. */
export const MEADOW_HEX = {
  "cream-paper": "#f5f1e4",
  "pure-white": "#ffffff",
  "ink-black": "#2c2e2a",
  "pure-ink": "#000000",
  "fresh-grass": "#8ed462",
} as const;
