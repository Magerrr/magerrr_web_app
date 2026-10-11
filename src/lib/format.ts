// Format tampilan (lapisan UI). Uang tetap integer rupiah sampai titik ini.
import type { GameRules } from "@/lib/core/rules";

const TIME_ZONE = "Asia/Jakarta";

/** 35000 → "Rp35.000" */
export function formatRupiah(value: number): string {
  if (!Number.isSafeInteger(value)) throw new RangeError(`rupiah harus integer, bukan ${value}`);
  const digits = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}Rp${digits}`;
}

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

/** "Jumat, 9 Oktober 2026" (WIB) */
export function formatDateId(date: Date): string {
  return dateFormat.format(date);
}

/** "19.00" (WIB) */
export function formatTimeId(date: Date): string {
  return timeFormat.format(date);
}

/** "19.00–21.00" (WIB) */
export function formatTimeRangeId(start: Date, durationMin: number | null): string {
  if (!durationMin) return formatTimeId(start);
  return `${formatTimeId(start)}–${formatTimeId(new Date(start.getTime() + durationMin * 60_000))}`;
}

const shortDateFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

/** "Jum, 9 Okt" (WIB) untuk daftar ringkas. */
export function formatShortDateId(date: Date): string {
  return shortDateFormat.format(date);
}

/** 90 → "1,5 jam", 120 → "2 jam", 45 → "45 menit" */
export function formatDurationId(minutes: number): string {
  if (minutes % 30 !== 0 || minutes < 60) return `${minutes} menit`;
  return `${String(minutes / 60).replace(".", ",")} jam`;
}

/** Penjelasan aturan skor untuk pengguna. */
export function describeRules(r: GameRules): string {
  if (!r.deuce) return `Game selesai saat satu sisi mencapai ${r.target} poin.`;
  return `Game selesai di ${r.target} poin. Jika ${r.target - 1}–${r.target - 1}, harus unggul 2 poin; maksimal ${r.cap}.`;
}

const monthFormat = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });

/** {year: 2026, month: 10} → "Oktober 2026" */
export function formatMonthId({ year, month }: { year: number; month: number }): string {
  return monthFormat.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** 0.6667 → "67%" */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Selisih poin bertanda: 5 → "+5", -11 → "−11" (tanda minus), 0 → "0" */
export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0";
}

/** "Dimas Pratama" → "DP", "raka" → "RA" (avatar teks) */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[words.length - 1]][0]];
  return letters.join("").toUpperCase();
}
