import { courtFit, PLAYERS_PER_COURT, type RsvpCounts } from "@/lib/core/rsvp";

/**
 * Ringkasan RSVP. Bawaan: Ikut / Tidak / Belum jawab + kecukupan lapangan (S3).
 * `compact` (kartu sesi di beranda, MAGERRR-15 ringkas): hanya "{ikut}/{kuota} ikut".
 */
export function RsvpSummary({
  counts,
  courtCount,
  className = "",
  compact = false,
}: {
  counts: RsvpCounts;
  courtCount: number;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    const quota = Math.max(0, Math.floor(courtCount)) * PLAYERS_PER_COURT;
    return (
      <p className={`text-small ${className}`} data-testid="rsvp-counts">
        {counts.going}/{quota} ikut
      </p>
    );
  }
  const fit = courtFit(courtCount, counts.going);
  return (
    <p className={`text-small ${className}`} data-testid="rsvp-counts">
      {counts.going} ikut · {counts.notGoing} tidak · {counts.noAnswer} belum jawab ·{" "}
      <span className={`font-semibold`}>{fit.label}</span>
    </p>
  );
}
