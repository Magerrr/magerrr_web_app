import { cx } from "./button-class";
import type { ServiceCourt } from "@/lib/core/scoring";

/** Ikon kok (shuttlecock); dekoratif, sertakan teks di sebelahnya. */
export function ShuttleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cx("shrink-0", className)}>
      <path d="M8.5 15.5 4 6.5c3-2 13-2 16 0l-4.5 9" />
      <path d="M9 7.2 10.2 15.5M15 7.2l-1.2 8.3M12 6.8v8.7" />
      <path d="M8.5 15.5h7v1.2a3.5 3.5 0 0 1-7 0z" fill="currentColor" />
    </svg>
  );
}

export const SERVICE_COURT_LABEL: Record<ServiceCourt, string> = { right: "kanan", left: "kiri" };
