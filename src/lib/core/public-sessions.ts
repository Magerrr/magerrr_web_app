// Logika murni daftar sesi publik (PRD #15, P1). Tanpa IO; waktu diberikan sebagai argumen.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 tanpa DST
const DAY_MS = 24 * 60 * 60 * 1000;

export type PublicRangeFilter =
  | { kind: "today" }
  | { kind: "week" }
  | { kind: "date"; date: string };

/** Rentang setengah-terbuka [from, to). */
export interface DateRange {
  from: Date;
  to: Date;
}

/** Awal hari WIB (ms epoch) yang memuat `ms`. */
function startOfWibDay(ms: number): number {
  return Math.floor((ms + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS;
}

/** Rentang waktu untuk filter hari ini / pekan ini (Senin–Minggu) / tanggal `YYYY-MM-DD`, semuanya WIB. Tanggal tidak valid → null. */
export function rangeFor(filter: PublicRangeFilter, now: Date): DateRange | null {
  if (filter.kind === "today") {
    const from = startOfWibDay(now.getTime());
    return { from: new Date(from), to: new Date(from + DAY_MS) };
  }
  if (filter.kind === "week") {
    const today = startOfWibDay(now.getTime());
    const dow = new Date(today + WIB_OFFSET_MS).getUTCDay(); // 0 = Minggu
    const from = today - ((dow + 6) % 7) * DAY_MS;
    return { from: new Date(from), to: new Date(from + 7 * DAY_MS) };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filter.date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(y, mo - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) return null;
  const from = utc.getTime() - WIB_OFFSET_MS;
  return { from: new Date(from), to: new Date(from + DAY_MS) };
}

export type PublicSessionStatus = "planned" | "running" | "finished" | "cancelled";

export interface JoinContext {
  status: PublicSessionStatus;
  startsAt: Date;
  /** peran pengguna; wasit tidak boleh ikut sebagai pemain */
  role: "player" | "referee";
  alreadyJoined?: boolean;
}

/** Alasan (Bahasa Indonesia) bila tidak boleh bergabung; `null` bila boleh. */
export function joinBlocker(ctx: JoinContext, now: Date): string | null {
  if (ctx.role === "referee") return "Wasit tidak bisa bergabung sebagai pemain.";
  if (ctx.status === "cancelled") return "Sesi ini dibatalkan.";
  if (ctx.status === "finished") return "Sesi ini sudah selesai.";
  if (ctx.alreadyJoined) return "Kamu sudah bergabung di sesi ini.";
  if (ctx.status === "planned" && ctx.startsAt.getTime() < now.getTime()) return "Sesi ini sudah lewat.";
  return null;
}

/** Rentang dari parameter URL `when` (+ `date`); nilai asing atau tanggal tidak valid → null (tanpa filter tanggal). */
export function rangeFromParams(when: string | undefined, date: string | undefined, now: Date): DateRange | null {
  if (when === "today" || when === "week") return rangeFor({ kind: when }, now);
  if (when === "date" && date) return rangeFor({ kind: "date", date }, now);
  return null;
}

/** Label kuota, mis. "3 slot tersisa", "Penuh", "5 pemain" (tanpa batas). */
export function quotaLabel(joined: number, quota: number | null): string {
  const n = Math.max(0, Math.floor(joined));
  if (quota === null || quota <= 0) return `${n} pemain`;
  const left = Math.floor(quota) - n;
  return left > 0 ? `${left} slot tersisa` : "Penuh";
}
