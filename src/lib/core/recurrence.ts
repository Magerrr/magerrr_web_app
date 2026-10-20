// Sesi berulang (PRD S5). Fungsi murni: tanggal berupa "YYYY-MM-DD" kalender WIB; "hari ini" diberikan pemanggil.
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Jumlah sesi mendatang maksimal yang disiapkan sekaligus. */
export const MAX_AHEAD = 4;

/** Mingguan, atau bulanan pada tanggal sama / hari sama di minggu ke-N. */
export type Repeat = { frequency: "weekly" } | { frequency: "monthly"; monthlyBy: "date" | "weekday" };

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** Hari dalam pekan untuk tanggal kalender: 0 = Minggu … 6 = Sabtu. */
export function weekdayOf(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** Hari dan urutannya dalam bulan ("Sabtu ke-3"); minggu ke-5 dianggap "terakhir" karena tidak ada di tiap bulan. */
export function monthlyWeekdayOf(date: string): { weekday: number; nth: 1 | 2 | 3 | 4 | "last" } {
  const d = new Date(toUtc(date));
  const nth = Math.ceil(d.getUTCDate() / 7);
  return { weekday: d.getUTCDay(), nth: nth >= 5 ? "last" : (nth as 1 | 2 | 3 | 4) };
}

/** Tanggal ke-k seri (k = 0 adalah tanggal awal). Dihitung dari tanggal awal, jadi tanggal 31 tidak bergeser permanen. */
export function occurrence(repeat: Repeat, anchor: string, k: number): string {
  const start = toUtc(anchor);
  if (!Number.isInteger(k) || k < 0) throw new RangeError(`urutan tidak valid: ${k}`);
  if (repeat.frequency === "weekly") return iso(start + 7 * k * DAY_MS);

  const a = new Date(start);
  const total = a.getUTCMonth() + k;
  const year = a.getUTCFullYear() + Math.floor(total / 12);
  const month = total % 12;
  const last = daysInMonth(year, month);
  if (repeat.monthlyBy === "date") return iso(Date.UTC(year, month, Math.min(a.getUTCDate(), last)));

  const { weekday, nth } = monthlyWeekdayOf(anchor);
  if (nth === "last") {
    const lastWeekday = new Date(Date.UTC(year, month, last)).getUTCDay();
    return iso(Date.UTC(year, month, last - ((lastWeekday - weekday + 7) % 7)));
  }
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return iso(Date.UTC(year, month, 1 + ((weekday - firstWeekday + 7) % 7) + 7 * (nth - 1)));
}

/**
 * Tanggal sesi yang perlu dibuat sekarang: `ahead` tanggal seri pertama yang ≥ `today`, dikurangi yang ≤ `lastDate`
 * (sudah pernah dibuat, termasuk yang kemudian dihapus). Tanggal yang sudah lewat tidak dibuat mundur.
 */
export function dueOccurrences(repeat: Repeat, anchor: string, lastDate: string, today: string, ahead: number): string[] {
  if (!Number.isInteger(ahead) || ahead < 1 || ahead > MAX_AHEAD) throw new RangeError(`jumlah sesi harus 1–${MAX_AHEAD}: ${ahead}`);
  toUtc(lastDate);
  toUtc(today);
  // Mulai dekat hari ini agar seri lama tidak diulang dari awal satu per satu.
  const elapsed = Math.max(0, Math.floor((toUtc(today) - toUtc(anchor)) / DAY_MS));
  let k = repeat.frequency === "weekly" ? Math.floor(elapsed / 7) : Math.max(0, Math.floor(elapsed / 31) - 1);
  const out: string[] = [];
  let upcoming = 0;
  while (upcoming < ahead) {
    const date = occurrence(repeat, anchor, k++);
    if (date < today) continue;
    upcoming++;
    if (date > lastDate) out.push(date);
  }
  return out;
}

/** "Tiap minggu, hari Jumat" / "Tiap bulan, tanggal 15" / "Tiap bulan, Sabtu ke-3" / "Tiap bulan, Sabtu terakhir". */
export function repeatLabel(repeat: Repeat, anchor: string): string {
  if (repeat.frequency === "weekly") return `Tiap minggu, hari ${DAYS[weekdayOf(anchor)]}`;
  if (repeat.monthlyBy === "date") return `Tiap bulan, tanggal ${Number(anchor.slice(8, 10))}`;
  const { weekday, nth } = monthlyWeekdayOf(anchor);
  return `Tiap bulan, ${DAYS[weekday]} ${nth === "last" ? "terakhir" : `ke-${nth}`}`;
}
