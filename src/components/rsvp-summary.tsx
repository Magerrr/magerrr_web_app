import { courtFit, type RsvpCounts } from "@/lib/core/rsvp";

/** Ringkasan satu baris: Ikut / Tidak / Belum jawab + kecukupan lapangan (S3). */
export function RsvpSummary({ counts, courtCount, className = "" }: { counts: RsvpCounts; courtCount: number; className?: string }) {
  const fit = courtFit(courtCount, counts.going);
  return (
    <p className={`text-small ${className}`} data-testid="rsvp-counts">
      {counts.going} ikut · {counts.notGoing} tidak · {counts.noAnswer} belum jawab ·{" "}
      <span className={`font-semibold`}>{fit.label}</span>
    </p>
  );
}
