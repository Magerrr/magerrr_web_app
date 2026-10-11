// Konversi tanggal & jam dinding Asia/Jakarta (WIB, UTC+7 tanpa DST) ↔ Date (UTC).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "2026-10-09" + "19:00" (WIB) → Date, atau null bila tidak valid. */
export function fromJakartaParts(date: string, time: string): Date | null {
  const d = DATE.exec(date);
  const t = TIME.exec(time);
  if (!d || !t) return null;
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const utc = Date.UTC(year, month - 1, day, Number(t[1]), Number(t[2])) - WIB_OFFSET_MS;
  const check = new Date(utc + WIB_OFFSET_MS);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(utc);
}

/** Date → { date: "2026-10-09", time: "19:00" } menurut WIB (untuk nilai awal input form). */
export function toJakartaParts(value: Date): { date: string; time: string } {
  const iso = new Date(value.getTime() + WIB_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Tanggal mingguan berikutnya dari `from` ("YYYY-MM-DD"): from + 7k hari, k >= 1, yang tidak sebelum `today` (S5). */
export function nextWeeklyDate(from: string, today: string): string {
  const base = fromJakartaParts(from, "12:00");
  const now = fromJakartaParts(today, "12:00");
  if (!base || !now) throw new RangeError(`tanggal tidak valid: ${from} / ${today}`);
  const week = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max(1, Math.ceil((now.getTime() - base.getTime()) / week));
  return toJakartaParts(new Date(base.getTime() + weeks * week)).date;
}
