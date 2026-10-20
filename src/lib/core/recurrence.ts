// Jadwal sesi mingguan (PRD S5). Fungsi murni: tanggal berupa "YYYY-MM-DD" kalender WIB; "hari ini" diberikan pemanggil.
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): number {
  const m = DATE.exec(date);
  if (!m) throw new RangeError(`tanggal tidak valid: ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    throw new RangeError(`tanggal tidak valid: ${date}`);
  }
  return ms;
}

/** Hari dalam pekan untuk tanggal kalender: 0 = Minggu … 6 = Sabtu. */
export function weekdayOf(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

/**
 * Tanggal sesi yang harus sudah dibuat pada `today`: semua tanggal berhari `weekday` dalam [today, today + leadDays].
 * Pemanggil membuat sesinya idempoten per (template, tanggal), jadi menjalankan ulang tidak menggandakan.
 */
export function dueDates(weekday: number, today: string, leadDays: number): string[] {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new RangeError(`hari tidak valid: ${weekday}`);
  if (!Number.isInteger(leadDays) || leadDays < 1) throw new RangeError(`hari sebelum harus bilangan bulat ≥ 1: ${leadDays}`);
  const start = toUtc(today);
  const out: string[] = [];
  for (let i = 0; i <= leadDays; i++) {
    const d = new Date(start + i * DAY_MS);
    if (d.getUTCDay() === weekday) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Durasi (menit) dari jam mulai ke jam selesai pada hari yang sama ("HH:MM"). */
export function durationBetween(start: string, end: string): number {
  const s = TIME.exec(start);
  const e = TIME.exec(end);
  if (!s || !e) throw new RangeError("Jam tidak valid.");
  const minutes = Number(e[1]) * 60 + Number(e[2]) - (Number(s[1]) * 60 + Number(s[2]));
  if (minutes <= 0) throw new RangeError("Jam selesai harus setelah jam mulai.");
  return minutes;
}
