import Link from "next/link";
import type { SessionSummary } from "@/lib/db/sessions";
import { formatShortDateId, formatTimeRangeId } from "@/lib/format";
import { toJakartaParts } from "@/lib/time";
import { Icon } from "./icons";

const DAY_MS = 86_400_000;
function untilLabel(session: SessionSummary, now: Date): string {
  if (session.status === "running") return "Berlangsung";
  const day = (d: Date) => Date.parse(toJakartaParts(d).date);
  const days = Math.round((day(session.startsAt) - day(now)) / DAY_MS);
  return days <= 0 ? "Hari ini" : days === 1 ? "Besok" : `${days} hari lagi`;
}

/**
 * Kartu sesi berikutnya/berlangsung (layar Beranda desain): isi ink-black, teks cream-paper, tombol aksen fresh-grass.
 * `groupName` = beranda utama (sesi dari banyak grup); tanpa itu = beranda grup.
 */
export function FeaturedSession({
  groupId,
  session: s,
  now,
  groupName,
  headingId = "sesi-berikutnya",
}: {
  groupId: string;
  session: SessionSummary;
  now: Date;
  groupName?: string;
  headingId?: string;
}) {
  return (
    <section aria-labelledby={headingId} className="flex h-full flex-col gap-4 rounded-2xl bg-ink-black p-5 text-cream-paper" data-testid="featured-session">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-caption text-ink-black ${s.status === "running" ? "bg-fresh-grass" : "bg-sunshine-pop"}`}
        >
          {s.status === "running" && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ink-black motion-safe:animate-pulse" />}
          {untilLabel(s, now)}
        </span>
        <h2 id={headingId} className="min-w-0 truncate text-small">
          {groupName ?? (s.status === "running" ? "Sesi sekarang" : "Sesi berikutnya")}
        </h2>
      </div>
      <p className="text-title">{formatShortDateId(s.startsAt)}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small">
        <li className="flex items-center gap-2">
          <Icon name="calendar" size={16} className="text-fresh-grass" />
          {formatTimeRangeId(s.startsAt, s.durationMin)}
        </li>
        {s.venue && (
          <li className="flex min-w-0 items-center gap-2">
            <Icon name="pin" size={16} className="shrink-0 text-fresh-grass" />
            <span className="truncate">{s.venue}</span>
          </li>
        )}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-small">
          {s.presentCount} hadir · {s.courtCount} lapangan
        </p>
        <Link
          href={`/g/${groupId}/sesi/${s.id}`}
          aria-label={groupName ? `Detail sesi ${groupName} ${formatShortDateId(s.startsAt)}` : undefined}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-fresh-grass px-5 text-ui text-ink-black"
        >
          Detail
        </Link>
      </div>
    </section>
  );
}
