// Metrik produk PRD §4, diturunkan dari event per sesi (tabel metric_events). Fungsi murni: waktu diberikan sebagai argumen.
export const METRIC_EVENTS = ["session_created", "session_finished", "score_recorded", "bill_created", "recap_shared", "link_opened"] as const;
export type MetricEvent = (typeof METRIC_EVENTS)[number];

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
export const METRIC_WEEKS = 8;

export interface SessionMetricInput {
  startsAt: Date;
  finished: boolean;
  /** waktu event session_created / session_finished; null bila tidak tercatat */
  createdAt: Date | null;
  finishedAt: Date | null;
  hasScore: boolean;
  hasBill: boolean;
  recapShared: boolean;
  /** peserta hadir selain host */
  nonHostPlayers: number;
  /** pembuka link unik (per anggota/perangkat) selain host */
  nonHostOpeners: number;
}

export interface MetricSummary {
  sessions: number;
  finishedSessions: number;
  /** semua rasio 0–1; null bila penyebutnya 0 */
  withScore: number | null;
  withBill: number | null;
  recapShared: number | null;
  openedLink: number | null;
  /** median menit dari sesi dibuat sampai ditutup; null bila belum ada data */
  medianMinutesToClose: number | null;
}

export interface WeekMetrics extends MetricSummary {
  /** Senin 00:00 WIB, dalam ISO UTC */
  weekStart: Date;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Senin 00:00 WIB pekan yang memuat `at`. */
export function weekStartWib(at: Date): Date {
  const wib = at.getTime() + WIB_OFFSET_MS;
  const day = Math.floor(wib / DAY_MS) * DAY_MS;
  const sinceMonday = (new Date(day).getUTCDay() + 6) % 7;
  return new Date(day - sinceMonday * DAY_MS - WIB_OFFSET_MS);
}

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

export function summarize(sessions: SessionMetricInput[]): MetricSummary {
  const done = sessions.filter((s) => s.finished);
  const players = done.reduce((n, s) => n + s.nonHostPlayers, 0);
  // Pembuka dibatasi jumlah peserta non-host agar penonton di luar peserta tidak menggelembungkan angka.
  const openers = done.reduce((n, s) => n + Math.min(s.nonHostOpeners, s.nonHostPlayers), 0);
  const minutes = done
    .filter((s) => s.createdAt && s.finishedAt && s.finishedAt >= s.createdAt)
    .map((s) => (s.finishedAt!.getTime() - s.createdAt!.getTime()) / 60000);
  return {
    sessions: sessions.length,
    finishedSessions: done.length,
    withScore: ratio(done.filter((s) => s.hasScore).length, done.length),
    withBill: ratio(done.filter((s) => s.hasBill).length, done.length),
    recapShared: ratio(done.filter((s) => s.recapShared).length, done.length),
    openedLink: ratio(openers, players),
    medianMinutesToClose: median(minutes),
  };
}

/** Ringkasan 8 pekan terakhir (termasuk pekan berjalan), per pekan dari Senin WIB, terbaru di atas, plus total. */
export function groupMetrics(sessions: SessionMetricInput[], now: Date): { total: MetricSummary; weeks: WeekMetrics[] } {
  const current = weekStartWib(now).getTime();
  const from = current - (METRIC_WEEKS - 1) * WEEK_MS;
  const inRange = sessions.filter((s) => {
    const t = weekStartWib(s.startsAt).getTime();
    return t >= from && t <= current;
  });
  const weeks: WeekMetrics[] = [];
  for (let i = 0; i < METRIC_WEEKS; i++) {
    const start = current - i * WEEK_MS;
    const mine = inRange.filter((s) => weekStartWib(s.startsAt).getTime() === start);
    weeks.push({ weekStart: new Date(start), ...summarize(mine) });
  }
  return { total: summarize(inRange), weeks };
}

/** Awal rentang kueri (Senin WIB, 8 pekan lalu) agar DB tidak memuat seluruh riwayat. */
export function metricsFrom(now: Date): Date {
  return new Date(weekStartWib(now).getTime() - (METRIC_WEEKS - 1) * WEEK_MS);
}
