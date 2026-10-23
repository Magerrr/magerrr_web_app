import Link from "next/link";
import type { SessionSummary } from "@/lib/db/sessions";
import { formatShortDateId, formatTimeRangeId } from "@/lib/format";
import { toJakartaParts } from "@/lib/time";
import { LinkPending } from "./button";
import { PENDING_LINK } from "./button-class";
import { RsvpSummary } from "./rsvp-summary";
import { Icon } from "./icons";

const DAY_MS = 86_400_000;
function untilLabel(session: SessionSummary, now: Date): string {
  if (session.status === "running") return "Berlangsung";
  const day = (d: Date) => Date.parse(toJakartaParts(d).date);
  const days = Math.round((day(session.startsAt) - day(now)) / DAY_MS);
  return days <= 0 ? "Hari ini" : days === 1 ? "Besok" : `${days} hari lagi`;
}

/** Warna kartu; tumpukan di beranda memberi tiap kartu `tone` acak (lihat `sessionTones`). Kelas ditulis utuh agar terbaca Tailwind. */
const TONES = [
  { card: "bg-ink-black text-cream-paper", live: "bg-fresh-grass text-ink-black", soon: "bg-sunshine-pop text-ink-black", dot: "bg-ink-black", button: "bg-fresh-grass text-ink-black", icon: "text-fresh-grass" },
  { card: "bg-sky-pop text-ink-black", live: "bg-ink-black text-cream-paper", soon: "bg-ink-black text-cream-paper", dot: "bg-fresh-grass", button: "bg-ink-black text-cream-paper", icon: "text-ink-black" },
  { card: "bg-coral-pop text-ink-black", live: "bg-ink-black text-cream-paper", soon: "bg-ink-black text-cream-paper", dot: "bg-fresh-grass", button: "bg-ink-black text-cream-paper", icon: "text-ink-black" },
  { card: "bg-fresh-grass text-ink-black", live: "bg-ink-black text-cream-paper", soon: "bg-ink-black text-cream-paper", dot: "bg-fresh-grass", button: "bg-ink-black text-cream-paper", icon: "text-ink-black" },
  { card: "bg-sunshine-pop text-ink-black", live: "bg-ink-black text-cream-paper", soon: "bg-ink-black text-cream-paper", dot: "bg-fresh-grass", button: "bg-ink-black text-cream-paper", icon: "text-ink-black" },
] as const;

/** Nomor warna acak tapi stabil per sesi (hash id), dan tak sama dengan kartu sebelumnya di tumpukan. */
export function sessionTones(ids: string[]): number[] {
  const tones: number[] = [];
  for (const id of ids) {
    let h = 0;
    for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    let t = h % TONES.length;
    if (tones.length && t === tones[tones.length - 1]) t = (t + 1) % TONES.length;
    tones.push(t);
  }
  // Tumpukan berputar: kartu terakhir bertetangga dengan yang pertama.
  if (tones.length > 2 && tones[tones.length - 1] === tones[0]) tones[tones.length - 1] = (tones[0] + 1) % TONES.length === tones[tones.length - 2] ? (tones[0] + 2) % TONES.length : (tones[0] + 1) % TONES.length;
  return tones;
}

/**
 * Kartu sesi berikutnya/berlangsung (layar Beranda desain): warna menurut `tone` (bawaan ink-black, teks cream-paper, tombol aksen fresh-grass).
 * `groupName` = beranda utama (sesi dari banyak grup); tanpa itu = beranda grup.
 */
export function FeaturedSession({
  groupId,
  session: s,
  now,
  groupName,
  headingId = "sesi-berikutnya",
  tone = 0,
}: {
  groupId: string;
  session: SessionSummary;
  now: Date;
  groupName?: string;
  headingId?: string;
  tone?: number;
}) {
  const t = TONES[tone % TONES.length];
  return (
    <section aria-labelledby={headingId} className={`flex h-full flex-col gap-4 rounded-2xl p-5 ${t.card}`} data-testid="featured-session">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-caption ${s.status === "running" ? t.live : t.soon}`}
        >
          {s.status === "running" && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${t.dot} motion-safe:animate-pulse`} />}
          {untilLabel(s, now)}
        </span>
        <h2 id={headingId} className="min-w-0 truncate text-small">
          {groupName ?? (s.status === "running" ? "Sesi sekarang" : "Sesi berikutnya")}
        </h2>
      </div>
      <p className="text-title">{formatShortDateId(s.startsAt)}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small">
        <li className="flex items-center gap-2">
          <Icon name="calendar" size={16} className={t.icon} />
          {formatTimeRangeId(s.startsAt, s.durationMin)}
        </li>
        {s.venue && (
          <li className="flex min-w-0 items-center gap-2">
            <Icon name="pin" size={16} className={`shrink-0 ${t.icon}`} />
            <span className="truncate">{s.venue}</span>
          </li>
        )}
      </ul>
      {s.status !== "finished" && <RsvpSummary counts={s.rsvpCounts} courtCount={s.courtCount} compact />}
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-small">
          {s.presentCount} hadir · {s.courtCount} lapangan
        </p>
        <Link
          href={`/g/${groupId}/sesi/${s.id}`}
          aria-label={groupName ? `Detail sesi ${groupName} ${formatShortDateId(s.startsAt)}` : undefined}
          className={`${PENDING_LINK} inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-5 text-ui ${t.button}`}
        >
          <LinkPending />
          Detail
        </Link>
      </div>
    </section>
  );
}
