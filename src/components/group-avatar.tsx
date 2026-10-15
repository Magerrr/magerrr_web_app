import { cx } from "./button-class";

const SIZE = { sm: "size-7 text-small", md: "size-11 text-sub", lg: "size-16 text-title" } as const;

/** Ikon grup: emoji, atau huruf pertama nama. Dekoratif (nama grup selalu tertulis di sebelahnya). */
export function GroupAvatar({
  name,
  emoji,
  size = "md",
  className,
}: {
  name: string;
  emoji: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-black bg-sandstone", SIZE[size], className)}
    >
      {emoji ?? name.slice(0, 1).toUpperCase()}
    </span>
  );
}
