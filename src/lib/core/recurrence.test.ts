import { describe, expect, it } from "vitest";
import { MAX_AHEAD, dueOccurrences, monthlyWeekdayOf, occurrence, repeatLabel, weekdayOf, type Repeat } from "./recurrence";

const WEEKLY: Repeat = { frequency: "weekly" };
const BY_DATE: Repeat = { frequency: "monthly", monthlyBy: "date" };
const BY_WEEKDAY: Repeat = { frequency: "monthly", monthlyBy: "weekday" };

describe("weekdayOf", () => {
  it("0 = Minggu … 6 = Sabtu", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(weekdayOf("2026-10-09")).toBe(5);
    expect(weekdayOf("2026-02-28")).toBe(6);
    expect(() => weekdayOf("2026-02-30")).toThrow(RangeError);
  });
});

describe("monthlyWeekdayOf", () => {
  it("urutan hari dalam bulan; minggu ke-5 dianggap 'terakhir'", () => {
    expect(monthlyWeekdayOf("2026-10-03")).toEqual({ weekday: 6, nth: 1 });
    expect(monthlyWeekdayOf("2026-10-17")).toEqual({ weekday: 6, nth: 3 });
    expect(monthlyWeekdayOf("2026-10-28")).toEqual({ weekday: 3, nth: 4 });
    expect(monthlyWeekdayOf("2026-10-31")).toEqual({ weekday: 6, nth: "last" });
  });
});

describe("occurrence", () => {
  it("k = 0 adalah tanggal awal", () => {
    expect(occurrence(WEEKLY, "2026-10-16", 0)).toBe("2026-10-16");
    expect(occurrence(BY_DATE, "2026-01-31", 0)).toBe("2026-01-31");
    expect(occurrence(BY_WEEKDAY, "2026-10-31", 0)).toBe("2026-10-31");
  });
  it("mingguan melewati pergantian bulan, tahun, dan 29 Februari", () => {
    expect(occurrence(WEEKLY, "2026-10-26", 1)).toBe("2026-11-02");
    expect(occurrence(WEEKLY, "2026-12-25", 1)).toBe("2027-01-01");
    expect(occurrence(WEEKLY, "2028-02-22", 1)).toBe("2028-02-29");
    expect(occurrence(WEEKLY, "2028-02-23", 1)).toBe("2028-03-01");
    expect(occurrence(WEEKLY, "2026-10-16", 52)).toBe("2027-10-15");
  });
  it("bulanan tanggal sama: tanggal yang tidak ada jadi hari terakhir bulan itu, lalu kembali", () => {
    expect(occurrence(BY_DATE, "2026-10-15", 1)).toBe("2026-11-15");
    expect(occurrence(BY_DATE, "2026-12-15", 1)).toBe("2027-01-15");
    expect(occurrence(BY_DATE, "2026-01-31", 1)).toBe("2026-02-28");
    expect(occurrence(BY_DATE, "2026-01-31", 2)).toBe("2026-03-31");
    expect(occurrence(BY_DATE, "2026-01-31", 3)).toBe("2026-04-30");
    expect(occurrence(BY_DATE, "2028-01-30", 1)).toBe("2028-02-29");
    expect(occurrence(BY_DATE, "2026-11-30", 3)).toBe("2027-02-28");
  });
  it("bulanan hari sama di minggu ke-N", () => {
    // Sabtu ke-1 Okt 2026 → Sabtu ke-1 Nov 7, Des 5, Jan 2027 2
    expect(occurrence(BY_WEEKDAY, "2026-10-03", 1)).toBe("2026-11-07");
    expect(occurrence(BY_WEEKDAY, "2026-10-03", 2)).toBe("2026-12-05");
    expect(occurrence(BY_WEEKDAY, "2026-10-03", 3)).toBe("2027-01-02");
    // Rabu ke-4 → Rabu ke-4 Feb 2027 = 24
    expect(occurrence(BY_WEEKDAY, "2026-10-28", 4)).toBe("2027-02-24");
    // Sabtu terakhir (31 Okt) → Sabtu terakhir Nov 28, Des 26, Feb 2027 27
    expect(occurrence(BY_WEEKDAY, "2026-10-31", 1)).toBe("2026-11-28");
    expect(occurrence(BY_WEEKDAY, "2026-10-31", 2)).toBe("2026-12-26");
    expect(occurrence(BY_WEEKDAY, "2026-10-31", 4)).toBe("2027-02-27");
  });
  it("menolak masukan tidak valid", () => {
    expect(() => occurrence(WEEKLY, "2026-02-30", 1)).toThrow(RangeError);
    expect(() => occurrence(WEEKLY, "2026-10-16", -1)).toThrow(RangeError);
    expect(() => occurrence(WEEKLY, "2026-10-16", 1.5)).toThrow(RangeError);
  });
});

describe("dueOccurrences (sesi berulang dibuat saat dibutuhkan)", () => {
  it("menyiapkan `ahead` sesi mendatang (tanggal ≥ hari ini) setelah tanggal terakhir yang sudah dibuat", () => {
    // seri baru: sesi awal 16 Okt sudah ada (last = anchor)
    expect(dueOccurrences(WEEKLY, "2026-10-16", "2026-10-16", "2026-10-12", 1)).toEqual([]);
    expect(dueOccurrences(WEEKLY, "2026-10-16", "2026-10-16", "2026-10-12", 3)).toEqual(["2026-10-23", "2026-10-30"]);
    // hari sesi itu sendiri masih dihitung "mendatang"
    expect(dueOccurrences(WEEKLY, "2026-10-16", "2026-10-16", "2026-10-16", 1)).toEqual([]);
    expect(dueOccurrences(WEEKLY, "2026-10-16", "2026-10-16", "2026-10-17", 1)).toEqual(["2026-10-23"]);
  });
  it("idempoten: setelah dibuat (last maju), panggilan ulang tidak menghasilkan apa pun", () => {
    const due = dueOccurrences(WEEKLY, "2026-10-16", "2026-10-16", "2026-10-12", 4);
    expect(due).toEqual(["2026-10-23", "2026-10-30", "2026-11-06"]);
    expect(dueOccurrences(WEEKLY, "2026-10-16", due.at(-1)!, "2026-10-12", 4)).toEqual([]);
  });
  it("aplikasi lama tidak dibuka: tanggal yang sudah lewat dilewati, tidak dibuat mundur", () => {
    expect(dueOccurrences(WEEKLY, "2026-10-02", "2026-10-02", "2026-10-20", 1)).toEqual(["2026-10-23"]);
    expect(dueOccurrences(WEEKLY, "2026-10-02", "2026-10-02", "2026-10-20", 2)).toEqual(["2026-10-23", "2026-10-30"]);
  });
  it("sesi yang dihapus (≤ tanggal terakhir) tidak dibuat ulang", () => {
    expect(dueOccurrences(WEEKLY, "2026-10-16", "2026-10-30", "2026-10-20", 2)).toEqual([]);
  });
  it("melewati pergantian bulan dan tahun", () => {
    expect(dueOccurrences(WEEKLY, "2026-12-18", "2026-12-18", "2026-12-28", 2)).toEqual(["2027-01-01", "2027-01-08"]);
    expect(dueOccurrences(BY_DATE, "2026-11-30", "2026-11-30", "2027-01-05", 2)).toEqual(["2027-01-30", "2027-02-28"]);
    expect(dueOccurrences(BY_WEEKDAY, "2026-10-31", "2026-10-31", "2026-12-01", 2)).toEqual(["2026-12-26", "2027-01-30"]);
  });
  it("menolak jumlah di luar 1–4", () => {
    expect(MAX_AHEAD).toBe(4);
    expect(() => dueOccurrences(WEEKLY, "2026-10-16", "2026-10-16", "2026-10-12", 0)).toThrow(RangeError);
    expect(() => dueOccurrences(WEEKLY, "2026-10-16", "2026-10-16", "2026-10-12", 5)).toThrow(RangeError);
  });
});

describe("repeatLabel", () => {
  it("teks pengulangan dalam Bahasa Indonesia", () => {
    expect(repeatLabel(WEEKLY, "2026-10-16")).toBe("Tiap minggu, hari Jumat");
    expect(repeatLabel(BY_DATE, "2026-10-15")).toBe("Tiap bulan, tanggal 15");
    expect(repeatLabel(BY_WEEKDAY, "2026-10-17")).toBe("Tiap bulan, Sabtu ke-3");
    expect(repeatLabel(BY_WEEKDAY, "2026-10-31")).toBe("Tiap bulan, Sabtu terakhir");
  });
});
