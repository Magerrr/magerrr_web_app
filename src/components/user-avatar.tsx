import Image from "next/image";
import { initials } from "@/lib/format";
import { cx } from "./button-class";

const SIZE = { sm: "size-11 text-ui", lg: "size-20 text-title" } as const;

/** Foto profil akun (MAGERRR-12), atau inisial nama di atas koral. Dekoratif: nama selalu tertulis di dekatnya. */
export function UserAvatar({ name, url, size = "sm", className }: { name: string; url: string | null; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-coral-pop text-ink-black",
        SIZE[size],
        className,
      )}
      data-testid="user-avatar"
    >
      {url ? (
        // Gambar privat lewat route server: tanpa optimasi next/image (sama dengan logo grup).
        <Image src={url} alt="" fill sizes="80px" unoptimized className="object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
