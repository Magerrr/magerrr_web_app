// Kelas tombol Meadow, aman dipakai di server maupun klien. Warna hanya dari token (globals.css).
export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export type Variant = "primary" | "accent" | "secondary" | "outline";
export type Size = "md" | "lg";

const BUTTON_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-ui font-medium " +
  // Hover: terangkat dengan bayangan; ditekan: kembali rata. Tanpa gerak untuk prefers-reduced-motion.
  "transition-[background-color,box-shadow,translate] duration-150 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0 " +
  // Sedang memproses (aria-busy): tetap berwarna, kursor tunggu. Nonaktif biasa: abu sandstone.
  "aria-busy:cursor-wait aria-busy:translate-y-0 aria-busy:shadow-none " +
  "disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:border-sandstone disabled:not-aria-busy:bg-sandstone " +
  "disabled:not-aria-busy:text-ink-black disabled:translate-y-0 disabled:shadow-none";
const BUTTON_VARIANT: Record<Variant, string> = {
  // Teks cream-paper di atas isi ink-black (12.1:1) — jangan ditiru cacat desain teks gelap di atas gelap.
  primary: "border-ink-black bg-ink-black text-cream-paper hover:bg-pure-ink hover:shadow-[0_3px_0_0_var(--color-fresh-grass)]",
  // Hover: hijau sedikit lebih gelap (dicampur 15% ink-black); teks ink-black tetap >= 5.9:1.
  accent:
    "border-ink-black bg-fresh-grass text-ink-black hover:bg-[color-mix(in_srgb,var(--color-fresh-grass)_85%,var(--color-ink-black))] " +
    "hover:shadow-[0_3px_0_0_var(--color-ink-black)]",
  // Isi hijau muda agar terlihat sebagai tombol, bukan kotak putih; hover = hijau penuh.
  secondary: "border-ink-black bg-fresh-grass/25 text-ink-black hover:bg-fresh-grass hover:shadow-[0_3px_0_0_var(--color-ink-black)]",
  // Garis tepi saja, tanpa isi; hover = hijau muda.
  outline: "border-ink-black bg-transparent text-ink-black hover:bg-fresh-grass/25 hover:shadow-[0_3px_0_0_var(--color-ink-black)]",
};
const BUTTON_SIZE: Record<Size, string> = { md: "min-h-11", lg: "min-h-13 w-full" };

/** Tombol berupa teks bergaris bawah (aksi sekunder/destruktif kecil). */
export const textButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-small underline underline-offset-4 transition-colors hover:bg-fresh-grass/25 aria-busy:cursor-wait";

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className);
}
