// Urutan sesi untuk kartu "sesi berikutnya" di beranda & beranda grup (MAGERRR-13). Murni: `now` sebagai argumen.
import type { SessionStatus } from "@/lib/core/session";

/** Sesi rencana masih dianggap "akan datang" sampai 3 jam setelah jam mulai (belum sempat dimulai di aplikasi). */
export const PLANNED_GRACE_MS = 3 * 3_600_000;

interface Ordered {
  status: SessionStatus;
  startsAt: Date;
}

/**
 * Sesi yang perlu perhatian: yang sedang berlangsung dulu, lalu sesi rencana yang belum lewat (terdekat dulu).
 * Seri diurutkan menurut jam mulai, lalu urutan masukan. Sesi selesai & rencana yang sudah lewat tidak ikut.
 */
export function activeSessions<T extends Ordered>(sessions: readonly T[], now: Date): T[] {
  const rank = (s: T) => (s.status === "running" ? 0 : 1);
  return sessions
    .filter((s) => s.status === "running" || (s.status === "planned" && s.startsAt.getTime() >= now.getTime() - PLANNED_GRACE_MS))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.s.startsAt.getTime() - b.s.startsAt.getTime() || a.i - b.i)
    .map(({ s }) => s);
}
