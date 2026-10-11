// Rasio kontras WCAG 2.x (dipakai checklist kontras di docs/CONTRAST.md, diuji otomatis).

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminans relatif dari "#rrggbb". */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new RangeError(`warna tidak valid: ${hex}`);
  const [r, g, b] = m.slice(1).map((x) => channel(Number.parseInt(x, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1–21; urutan argumen bebas. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
