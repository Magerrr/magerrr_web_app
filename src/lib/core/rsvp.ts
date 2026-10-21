// Ringkasan RSVP dan kecukupan lapangan (PRD S3). Fungsi murni.

export type RsvpAnswer = "going" | "maybe" | "not_going";

export interface RsvpCounts {
  going: number;
  maybe: number;
  notGoing: number;
  /** anggota aktif yang belum menjawab */
  noAnswer: number;
}

/** Pemain per lapangan (ganda). */
export const PLAYERS_PER_COURT = 4;

/** Hitung jawaban; `answers` = jawaban anggota yang sudah menjawab, `memberCount` = total anggota aktif. */
export function summarizeRsvp(answers: readonly RsvpAnswer[], memberCount: number): RsvpCounts {
  const counts = { going: 0, maybe: 0, notGoing: 0 };
  for (const a of answers) {
    if (a === "going") counts.going++;
    else if (a === "maybe") counts.maybe++;
    else counts.notGoing++;
  }
  const answered = counts.going + counts.maybe + counts.notGoing;
  return { ...counts, noAnswer: Math.max(0, memberCount - answered) };
}

export type CourtFit = { kind: "short" | "enough" | "extra"; diff: number; label: string };

/** Bandingkan lapangan x 4 dengan jumlah yang ikut. */
export function courtFit(courtCount: number, going: number): CourtFit {
  const slots = Math.max(0, Math.floor(courtCount)) * PLAYERS_PER_COURT;
  const players = Math.max(0, Math.floor(going));
  const diff = slots - players;
  if (diff > 0) return { kind: "extra", diff, label: `Lebih ${diff} pemain` };
  if (diff < 0) return { kind: "short", diff: -diff, label: `Kurang ${-diff} pemain` };
  return { kind: "enough", diff: 0, label: "Cukup" };
}

/**
 * Alasan sesi tidak bisa diikuti lewat Jelajah, atau null bila masih terbuka. `now` diberikan pemanggil.
 * Sesi dianggap lewat setelah jam mulai + durasi (bawaan 120 menit bila durasi kosong).
 */
export function joinBlockReason(
  session: { status: "planned" | "running" | "finished"; startsAt: Date; durationMin: number | null },
  now: Date,
): string | null {
  if (session.status === "finished") return "Sesi ini sudah selesai.";
  if (session.startsAt.getTime() + (session.durationMin ?? 120) * 60_000 <= now.getTime()) return "Sesi ini sudah lewat.";
  return null;
}
