import Image from "next/image";
import { THEME_BG, type GroupTheme } from "@/lib/group-theme";
import { cx } from "./button-class";

const SIZE = { sm: "size-7 text-small", md: "size-11 text-sub", lg: "size-16 text-title", xl: "size-20 text-title" } as const;

/**
 * Ikon grup: logo bila ada, selain itu emoji atau huruf pertama nama di atas warna tema grup (MAGERRR-8).
 * Dekoratif (nama grup selalu tertulis di sebelahnya).
 */
export function GroupAvatar({
  name,
  emoji,
  logoUrl = null,
  theme = "sand",
  size = "md",
  className,
}: {
  name: string;
  emoji: string | null;
  logoUrl?: string | null;
  theme?: GroupTheme;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-black text-ink-black",
        logoUrl ? "bg-pure-white" : THEME_BG[theme],
        SIZE[size],
        className,
      )}
    >
      {logoUrl ? (
        // Gambar privat lewat route server: tanpa optimasi next/image (sama dengan QRIS).
        <Image src={logoUrl} alt="" fill sizes="80px" unoptimized className="object-cover" />
      ) : (
        (emoji ?? name.slice(0, 1).toUpperCase())
      )}
    </span>
  );
}
