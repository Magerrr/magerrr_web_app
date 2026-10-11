import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, luminance } from "./contrast";

const tokens = JSON.parse(readFileSync("docs/design/project/ds/meadow/tokens.json", "utf8")) as {
  color: { tokens: { name: string; value: string }[] };
};
const hex = (name: string) => {
  const value = tokens.color.tokens.find((t) => t.name === name)?.value;
  if (!value?.startsWith("#")) throw new Error(`token ${name} tidak ada`);
  return value;
};

// Checklist kontras (docs/CONTRAST.md): pasangan teks/latar yang benar-benar dipakai UI.
// Teks: >= 4.5:1 (WCAG AA). Komponen non-teks (batas kontrol, cincin progres): >= 3:1.
const TEXT_PAIRS: [fg: string, bg: string, where: string][] = [
  ["ink-black", "cream-paper", "teks halaman"],
  ["ink-black", "pure-white", "kartu, input, tombol sekunder"],
  ["ink-black", "sandstone", "tombol nonaktif, badge redup"],
  ["ink-black", "fresh-grass", "tombol aksen, baris 'kamu', juara"],
  ["ink-black", "sunshine-pop", "banner offline"],
  ["cream-paper", "ink-black", "tombol utama, kartu progres, podium"],
  ["cream-paper", "pure-ink", "avatar, blok podium 2–3"],
];
const NON_TEXT_PAIRS: [fg: string, bg: string, where: string][] = [
  ["ink-black", "cream-paper", "border kontrol di latar halaman"],
  ["ink-black", "pure-white", "border kontrol di kartu"],
  ["fresh-grass", "pure-ink", "cincin lunas"],
];
// Dekoratif (makna selalu dibawa teks ink-black di dalamnya, WCAG 1.4.11 tidak berlaku):
// outline coral-pop pada pesan error / "Menunggu konfirmasi" (2.7:1), hairline-mist pemisah baris.

describe("contrastRatio", () => {
  it("nilai acuan WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(luminance("#ffffff")).toBe(1);
    expect(() => luminance("white")).toThrow(RangeError);
  });
});

describe("checklist kontras Meadow", () => {
  it.each(TEXT_PAIRS)("teks %s di atas %s (%s) >= 4.5:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)("non-teks %s di atas %s (%s) >= 3:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
  });

  it("stone-gray tidak lolos untuk teks kecil (hanya >= 24px, README Meadow)", () => {
    expect(contrastRatio(hex("stone-gray"), hex("cream-paper"))).toBeLessThan(4.5);
  });
});
