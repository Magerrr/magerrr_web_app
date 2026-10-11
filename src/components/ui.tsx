// Primitif UI Meadow. Warna hanya dari token (globals.css); target sentuh >= 44px.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type Variant = "primary" | "accent" | "secondary";
type Size = "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border px-5 text-ui font-medium " +
  "disabled:cursor-not-allowed disabled:border-sandstone disabled:bg-sandstone disabled:text-ink-black";
const BUTTON_VARIANT: Record<Variant, string> = {
  // Teks cream-paper di atas isi ink-black (12.1:1) — jangan ditiru cacat desain teks gelap di atas gelap.
  primary: "border-ink-black bg-ink-black text-cream-paper hover:bg-pure-ink",
  accent: "border-ink-black bg-fresh-grass text-ink-black",
  secondary: "border-ink-black bg-pure-white text-ink-black hover:bg-sandstone",
};
const BUTTON_SIZE: Record<Size, string> = { md: "min-h-11", lg: "min-h-13 w-full" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Tautan teks (bukan tombol): tetap punya area sentuh >= 44px. */
export const textLinkClass = "inline-flex min-h-11 items-center self-start text-small underline underline-offset-2";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-2xl border border-ink-black bg-pure-white p-5", className)} {...props} />;
}

type BadgeTone = "accent" | "outline" | "neutral" | "muted";
const BADGE_TONE: Record<BadgeTone, string> = {
  accent: "border-ink-black bg-fresh-grass",
  // Outline coral selalu dengan teks ink-black (README Meadow).
  outline: "border-coral-pop bg-pure-white",
  neutral: "border-ink-black bg-cream-paper",
  muted: "border-sandstone bg-sandstone",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex h-6 items-center rounded-full border px-2.5 text-caption text-ink-black", BADGE_TONE[tone])}>
      {children}
    </span>
  );
}

/** Pesan status/error: teks ink-black, outline coral untuk error. */
export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-lg border-2 bg-pure-white px-4 py-3 text-small text-ink-black",
        tone === "error" ? "border-coral-pop" : "border-fresh-grass",
      )}
    >
      {children}
    </p>
  );
}

/** Gaya field tanpa lebar; pakai `inputClass` (lebar penuh) atau tambahkan lebar sendiri. */
export const inputBase = "h-13 rounded-lg border-2 border-ink-black bg-pure-white px-4 text-ui text-ink-black";
export const inputClass = `${inputBase} w-full`;

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-small font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-caption">{hint}</p>}
    </div>
  );
}

/** Pilihan tunggal berbentuk pill (radio group). Terpilih = isi ink-black, teks cream-paper. */
export function Segmented<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-small font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={cx(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-ink-black px-4 text-ui",
              "has-checked:bg-ink-black has-checked:text-cream-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink-black",
              "bg-pure-white text-ink-black",
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/*
 * Tata letak responsif. Ponsel (< 640px) = satu kolom penuh, target utama (PRD §9).
 * Tablet (sm/md) = padding lebih lega, daftar boleh 2 kolom. Desktop (lg >= 1024px) = sidebar grup (layout g/[groupId]).
 * Dua panel di dalam halaman memakai container query `@panel:` (lebar konten `Page` >= 60rem), bukan lebar layar,
 * karena sidebar mengurangi ruang konten.
 */
const PAGE_WIDTH = {
  /** form & halaman satu tugas */
  narrow: "max-w-xl",
  /** konten satu kolom (daftar, obrolan) */
  regular: "max-w-3xl",
  /** dasbor dengan dua kolom di desktop */
  wide: "max-w-6xl",
} as const;
export type PageWidth = keyof typeof PAGE_WIDTH;

/** Kelas untuk elemen yang melebar sampai tepi layar (mis. bagan geser, kolom kirim obrolan); ikut padding `Page`. */
export const bleedX = "-mx-5 px-5 sm:-mx-8 sm:px-8";

export function Page({ children, width = "regular" }: { children: ReactNode; width?: PageWidth }) {
  return (
    <main
      id="konten"
      className={cx("@container mx-auto flex min-h-dvh w-full flex-col gap-6 px-5 pt-6 pb-16 sm:px-8 sm:pt-8 lg:pb-20", PAGE_WIDTH[width])}
    >
      {children}
    </main>
  );
}

/**
 * Dua kolom bila konten cukup lebar (`@panel`): konten utama + kolom kedua. Lebih sempit: bertumpuk sesuai urutan DOM
 * (`main` lalu `aside`). `aside` = kolom samping sempit; `half` = dua kolom sama lebar.
 * Tanpa `aside` (null) tetap satu kolom; `main` tidak dipasang ulang saat `aside` muncul/hilang.
 */
export function Split({ main, aside, variant = "aside" }: { main: ReactNode; aside: ReactNode; variant?: "aside" | "half" }) {
  const twoColumns = aside !== null && aside !== undefined && aside !== false;
  return (
    <div
      className={cx(
        "flex flex-col gap-6",
        twoColumns && "@panel:grid @panel:items-start @panel:gap-8",
        twoColumns && (variant === "aside" ? "@panel:grid-cols-[minmax(0,1fr)_22rem]" : "@panel:grid-cols-2"),
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      {twoColumns && <div className="flex min-w-0 flex-col gap-6">{aside}</div>}
    </div>
  );
}

export function BackLink({ href, label = "Kembali" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink-black bg-pure-white"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}

export function TopBar({ back, title, children }: { back?: string; title?: string; children?: ReactNode }) {
  return (
    <header className="flex min-h-11 items-center gap-3">
      {back && <BackLink href={back} />}
      {title ? <p className="min-w-0 flex-1 truncate text-lead">{title}</p> : <div className="flex-1" />}
      {children}
    </header>
  );
}
