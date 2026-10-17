import Link from "next/link";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";
import type { SessionSummary } from "@/lib/db/sessions";
import { formatShortDateId, formatTimeRangeId } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "./sesi/status";

/**
 * Baris sesi di daftar grup dan di panel kiri split view. `current` = sesi yang sedang dibuka di panel kanan.
 * `groupName` = daftar lintas grup (beranda utama & "Semua sesi").
 */
export function SessionLink({
  groupId,
  session: s,
  current = false,
  testId = true,
  compact = false,
  groupName,
}: {
  groupId: string;
  session: SessionSummary;
  current?: boolean;
  testId?: boolean;
  /** panel sempit (split view): tanpa ikon, tanggal tidak membungkus */
  compact?: boolean;
  groupName?: string;
}) {
  return (
    <Link
      href={`/g/${groupId}/sesi/${s.id}`}
      aria-current={current ? "page" : undefined}
      className={
        "flex h-full min-h-16 items-center rounded-2xl border px-4 py-3 " + (compact ? "gap-2 " : "gap-4 ") +
        (current ? "border-1 border-ink-black bg-fresh-grass" : "border-ink-black bg-pure-white hover:bg-cream-paper")
      }
      data-testid={testId ? "session-item" : undefined}
    >
      {!compact && (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-sky-pop bg-pure-white" aria-hidden="true">
          <Icon name="shuttle" size={30} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {groupName && <span className="truncate text-caption">{groupName}</span>}
        <span className={compact ? "text-ui whitespace-nowrap" : "text-lead"}>{formatShortDateId(s.startsAt)}</span>
        <span className="truncate text-small">
          {formatTimeRangeId(s.startsAt, s.durationMin)}
          {s.venue ? ` · ${s.venue}` : ""}
        </span>
        <span className="text-small">
          {s.presentCount} hadir · {s.courtCount} lapangan
        </span>
      </span>
      <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
    </Link>
  );
}
