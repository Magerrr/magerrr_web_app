import { describe, expect, it } from "vitest";
import {
  formatDateId,
  formatDurationId,
  formatMonthId,
  formatPercent,
  formatSigned,
  initials,
  formatRupiah,
  formatShortDateId,
  formatTimeId,
  formatTimeRangeId,
} from "./format";

describe("formatRupiah", () => {
  it("35000 → Rp35.000", () => {
    expect(formatRupiah(35_000)).toBe("Rp35.000");
  });

  it("pemisah ribuan titik, tanpa desimal", () => {
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(500)).toBe("Rp500");
    expect(formatRupiah(1_234_567)).toBe("Rp1.234.567");
    expect(formatRupiah(-245_000)).toBe("-Rp245.000");
  });

  it("bukan integer → RangeError", () => {
    expect(() => formatRupiah(1.5)).toThrow(RangeError);
    expect(() => formatRupiah(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatDateId / formatTimeId (Asia/Jakarta)", () => {
  it("tanggal panjang bahasa Indonesia", () => {
    expect(formatDateId(new Date("2026-10-09T12:00:00Z"))).toBe("Jumat, 9 Oktober 2026");
  });

  it("batas hari mengikuti WIB", () => {
    expect(formatDateId(new Date("2026-09-30T18:00:00Z"))).toBe("Kamis, 1 Oktober 2026");
  });

  it("jam 24 jam dengan titik", () => {
    expect(formatTimeId(new Date("2026-10-09T12:00:00Z"))).toBe("19.00");
  });
});

describe("format sesi", () => {
  it("rentang jam, tanggal ringkas, durasi", () => {
    const start = new Date("2026-10-09T12:00:00Z");
    expect(formatTimeRangeId(start, 120)).toBe("19.00–21.00");
    expect(formatTimeRangeId(start, null)).toBe("19.00");
    expect(formatShortDateId(start)).toBe("Jum, 9 Okt");
    expect(formatDurationId(120)).toBe("2 jam");
    expect(formatDurationId(90)).toBe("1,5 jam");
    expect(formatDurationId(45)).toBe("45 menit");
  });
});

describe("format leaderboard", () => {
  it("formatMonthId", () => {
    expect(formatMonthId({ year: 2026, month: 10 })).toBe("Oktober 2026");
    expect(formatMonthId({ year: 2027, month: 1 })).toBe("Januari 2027");
  });

  it("formatPercent", () => {
    expect(formatPercent(2 / 3)).toBe("67%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("formatSigned", () => {
    expect(formatSigned(5)).toBe("+5");
    expect(formatSigned(-11)).toBe("−11");
    expect(formatSigned(0)).toBe("0");
  });

  it("initials", () => {
    expect(initials("Dimas Pratama")).toBe("DP");
    expect(initials("raka")).toBe("RA");
    expect(initials("  Sinta  Ayu Dewi ")).toBe("SD");
    expect(initials("p1")).toBe("P1");
    expect(initials("")).toBe("?");
  });
});
