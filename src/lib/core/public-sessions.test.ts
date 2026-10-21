import { describe, expect, it } from "vitest";
import { joinBlocker, quotaLabel, rangeFor } from "./public-sessions";

// 2026-10-21 (Rabu) 10:00 WIB = 03:00 UTC
const NOW = new Date("2026-10-21T03:00:00Z");

describe("rangeFor (Asia/Jakarta)", () => {
  it("semua: mulai dari sekarang, tanpa batas atas", () => {
    expect(rangeFor("semua", NOW)).toEqual({ from: NOW, to: null });
  });
  it("hari ini: sekarang s.d. 00:00 WIB besok", () => {
    expect(rangeFor("hari-ini", NOW)).toEqual({ from: NOW, to: new Date("2026-10-21T17:00:00Z") });
  });
  it("pekan ini: sekarang s.d. Senin 00:00 WIB berikutnya", () => {
    expect(rangeFor("pekan-ini", NOW)).toEqual({ from: NOW, to: new Date("2026-10-25T17:00:00Z") });
  });
  it("pekan ini di hari Minggu berakhir malam itu", () => {
    const sunday = new Date("2026-10-25T03:00:00Z");
    expect(rangeFor("pekan-ini", sunday)?.to).toEqual(new Date("2026-10-25T17:00:00Z"));
  });
  it("tanggal pilihan: 00:00–24:00 WIB, tapi tidak sebelum sekarang", () => {
    expect(rangeFor("tanggal", NOW, "2026-10-30")).toEqual({
      from: new Date("2026-10-29T17:00:00Z"),
      to: new Date("2026-10-30T17:00:00Z"),
    });
    expect(rangeFor("tanggal", NOW, "2026-10-21")?.from).toEqual(NOW);
  });
  it("tanggal lampau atau tidak valid → null", () => {
    expect(rangeFor("tanggal", NOW, "2026-10-20")).toBeNull();
    expect(rangeFor("tanggal", NOW, "2026-13-40")).toBeNull();
    expect(rangeFor("tanggal", NOW)).toBeNull();
  });
});

describe("joinBlocker", () => {
  const base = { status: "planned" as const, startsAt: new Date("2026-10-22T12:00:00Z") };
  it("sesi mendatang bisa diikuti", () => expect(joinBlocker(base, "member", NOW)).toBeNull());
  it("wasit ditolak", () => expect(joinBlocker(base, "referee", NOW)).toMatch(/Wasit/));
  it("selesai / berlangsung / lewat ditolak", () => {
    expect(joinBlocker({ ...base, status: "finished" }, "member", NOW)).toMatch(/selesai/);
    expect(joinBlocker({ ...base, status: "running" }, "member", NOW)).toMatch(/sudah dimulai/);
    expect(joinBlocker({ ...base, startsAt: new Date("2026-10-21T02:00:00Z") }, "member", NOW)).toMatch(/sudah lewat/);
  });
});

describe("quotaLabel", () => {
  it("tanpa kuota", () => expect(quotaLabel(0, null)).toBe("0 ikut"));
  it("dengan kuota", () => expect(quotaLabel(5, 12)).toBe("5 dari 12 ikut"));
  it("penuh", () => expect(quotaLabel(12, 12)).toBe("Penuh (12 dari 12)"));
});
