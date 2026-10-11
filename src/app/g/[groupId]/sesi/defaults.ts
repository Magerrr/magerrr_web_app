import { toJakartaParts } from "@/lib/time";

/** Tanggal hari ini (WIB) untuk nilai awal form sesi baru (PRD Flow A: tanggal otomatis hari ini). */
export function todayInJakarta(): string {
  return toJakartaParts(new Date()).date;
}
