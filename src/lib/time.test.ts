import { describe, expect, it } from "vitest";
import { fromJakartaParts, greeting, nextWeeklyDate, toJakartaParts } from "./time";

describe("fromJakartaParts / toJakartaParts", () => {
  it("19:00 WIB = 12:00 UTC", () => {
    expect(fromJakartaParts("2026-10-09", "19:00")?.toISOString()).toBe("2026-10-09T12:00:00.000Z");
  });

  it("dini hari WIB jatuh di hari sebelumnya dalam UTC", () => {
    expect(fromJakartaParts("2026-10-01", "01:30")?.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("bolak-balik konsisten", () => {
    const date = new Date("2026-12-31T17:15:00Z");
    expect(toJakartaParts(date)).toEqual({ date: "2027-01-01", time: "00:15" });
    const { date: d, time: t } = toJakartaParts(date);
    expect(fromJakartaParts(d, t)?.getTime()).toBe(date.getTime());
  });

  it("input tidak valid → null", () => {
    for (const [d, t] of [
      ["2026-02-30", "19:00"],
      ["2026-10-09", "24:00"],
      ["09-10-2026", "19:00"],
      ["2026-10-09", "7:00"],
      ["", ""],
    ]) {
      expect(fromJakartaParts(d, t), `${d} ${t}`).toBeNull();
    }
  });
});

describe("nextWeeklyDate (sesi berulang)", () => {
  it("minggu depan dari tanggal sesi, tidak pernah sebelum hari ini", () => {
    expect(nextWeeklyDate("2026-10-09", "2026-10-09")).toBe("2026-10-16");
    expect(nextWeeklyDate("2026-10-09", "2026-10-12")).toBe("2026-10-16");
    expect(nextWeeklyDate("2026-10-09", "2026-10-16")).toBe("2026-10-16");
    expect(nextWeeklyDate("2026-10-09", "2026-10-17")).toBe("2026-10-23");
    expect(nextWeeklyDate("2026-12-31", "2026-12-01")).toBe("2027-01-07");
    expect(() => nextWeeklyDate("2026-02-30", "2026-10-01")).toThrow(RangeError);
  });
});

describe("greeting", () => {
  it("batas jam WIB: pagi < 11, siang < 15, sore < 18, malam", () => {
    const wib = (time: string) => fromJakartaParts("2026-10-16", time)!;
    expect(greeting(wib("00:00"))).toBe("Selamat pagi");
    expect(greeting(wib("10:59"))).toBe("Selamat pagi");
    expect(greeting(wib("11:00"))).toBe("Selamat siang");
    expect(greeting(wib("15:00"))).toBe("Selamat sore");
    expect(greeting(wib("17:59"))).toBe("Selamat sore");
    expect(greeting(wib("18:00"))).toBe("Selamat malam");
  });
});
