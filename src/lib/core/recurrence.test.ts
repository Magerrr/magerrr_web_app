import { describe, expect, it } from "vitest";
import { dueDates, durationBetween, weekdayOf } from "./recurrence";

describe("weekdayOf", () => {
  it("0 = Minggu … 6 = Sabtu", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(weekdayOf("2026-10-09")).toBe(5);
    expect(weekdayOf("2026-02-28")).toBe(6);
    expect(() => weekdayOf("2026-02-30")).toThrow(RangeError);
  });
});

describe("dueDates (sesi mingguan otomatis)", () => {
  it("memilih tanggal berhari sama dalam [hari ini, hari ini + N]", () => {
    expect(dueDates(5, "2026-10-12", 7)).toEqual(["2026-10-16"]);
    expect(dueDates(5, "2026-10-16", 7)).toEqual(["2026-10-16", "2026-10-23"]);
    expect(dueDates(5, "2026-10-17", 7)).toEqual(["2026-10-23"]);
  });
  it("N lebih kecil dari seminggu bisa tanpa tanggal", () => {
    expect(dueDates(5, "2026-10-12", 2)).toEqual([]);
    expect(dueDates(5, "2026-10-14", 2)).toEqual(["2026-10-16"]);
  });
  it("melewati pergantian bulan dan tahun", () => {
    expect(dueDates(1, "2026-10-27", 7)).toEqual(["2026-11-02"]);
    expect(dueDates(5, "2026-12-28", 7)).toEqual(["2027-01-01"]);
    expect(dueDates(0, "2028-02-24", 7)).toEqual(["2028-02-27"]);
    expect(dueDates(3, "2028-02-25", 7)).toEqual(["2028-03-01"]); // 2028 kabisat: 29 Feb ada
  });
  it("idempoten: hasil sama untuk masukan sama, tanpa duplikat", () => {
    const a = dueDates(2, "2026-12-30", 14);
    expect(a).toEqual(dueDates(2, "2026-12-30", 14));
    expect(new Set(a).size).toBe(a.length);
    expect(a).toEqual(["2027-01-05", "2027-01-12"]);
  });
  it("menolak masukan tidak valid", () => {
    expect(() => dueDates(7, "2026-10-12", 7)).toThrow(RangeError);
    expect(() => dueDates(1, "2026-10-12", 0)).toThrow(RangeError);
    expect(() => dueDates(1, "bukan-tanggal", 7)).toThrow(RangeError);
  });
});

describe("durationBetween", () => {
  it("menit antara jam mulai dan selesai", () => {
    expect(durationBetween("19:00", "21:30")).toBe(150);
    expect(durationBetween("08:05", "09:00")).toBe(55);
  });
  it("selesai harus setelah mulai", () => {
    expect(() => durationBetween("21:00", "21:00")).toThrow(RangeError);
    expect(() => durationBetween("21:00", "20:00")).toThrow(RangeError);
    expect(() => durationBetween("25:00", "26:00")).toThrow(RangeError);
  });
});
