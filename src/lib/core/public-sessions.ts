// Pencarian & ikut sesi grup publik (issue #15): rentang tanggal WIB, penghalang ikut, label kuota.
// Murni: waktu diberikan sebagai argumen.
import { fromJakartaParts, toJakartaParts } from "@/lib/time";
import { canPlay, type MemberRole } from "./roles";
import type { SessionStatus } from "./session";

export type DateFilter = "semua" | "hari-ini" | "pekan-ini" | "tanggal";
export const DATE_FILTERS: readonly DateFilter[] = ["semua", "hari-ini", "pekan-ini", "tanggal"];

export interface DateRange {
  from: Date;
  /** eksklusif; null = tanpa batas atas */
  to: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Rentang `starts_at` untuk filter tanggal (WIB). Selalu mulai paling cepat `now`. null = filter tidak valid / sudah lewat. */
export function rangeFor(filter: DateFilter, now: Date, pickedDate?: string): DateRange | null {
  const midnight = fromJakartaParts(toJakartaParts(now).date, "00:00");
  if (!midnight) return null;
  if (filter === "semua") return { from: now, to: null };
  if (filter === "hari-ini") return { from: now, to: new Date(midnight.getTime() + DAY_MS) };
  if (filter === "pekan-ini") {
    const weekday = (new Date(midnight.getTime() + WIB_OFFSET_MS).getUTCDay() + 6) % 7; // Senin = 0
    return { from: now, to: new Date(midnight.getTime() + (7 - weekday) * DAY_MS) };
  }
  const start = pickedDate ? fromJakartaParts(pickedDate, "00:00") : null;
  if (!start) return null;
  const end = new Date(start.getTime() + DAY_MS);
  if (end.getTime() <= now.getTime()) return null;
  return { from: start.getTime() < now.getTime() ? now : start, to: end };
}

/** Alasan sesi tidak bisa diikuti lewat jelajah, atau null bila boleh. Pesan untuk pengguna. */
export function joinBlocker(
  session: { status: SessionStatus; startsAt: Date },
  role: MemberRole,
  now: Date,
): string | null {
  if (!canPlay(role)) return "Wasit tidak ikut bermain, jadi tidak bisa ikut sesi sebagai peserta.";
  if (session.status === "finished") return "Sesi ini sudah selesai.";
  if (session.status === "running") return "Sesi ini sudah dimulai.";
  if (session.startsAt.getTime() < now.getTime()) return "Waktu sesi ini sudah lewat.";
  return null;
}

/** Label jumlah "Ikut"; `max` null = tanpa kuota (kuota = P1, belum dipakai). */
export function quotaLabel(going: number, max: number | null): string {
  if (max === null) return going + " ikut";
  return going >= max ? "Penuh (" + going + " dari " + max + ")" : going + " dari " + max + " ikut";
}
