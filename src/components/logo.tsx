import { cx } from "./button-class";

/** Tanda merek Magerrr (sama dengan src/app/icon.svg); dekoratif, sertakan teks di sebelahnya. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-fresh-grass" />
      <g transform="translate(2.4 2.4) scale(1.133)">
        <path
          d="M4.7 10.3 L5.1 3.8 L9.7 7.2 Q12 6.6 14.3 7.2 L18.9 3.8 L19.3 10.3 Q20.3 13.2 18.9 16 Q16.8 20.1 12 20.1 Q7.2 20.1 5.1 16 Q3.7 13.2 4.7 10.3Z"
          className="fill-ink-black"
        />
        <circle cx="9.3" cy="12.4" r="1.6" className="fill-fresh-grass" />
        <circle cx="14.7" cy="12.4" r="1.6" className="fill-fresh-grass" />
      </g>
    </svg>
  );
}

/** Logo lengkap: tanda + nama. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-lead">Magerrr</span>
    </span>
  );
}
