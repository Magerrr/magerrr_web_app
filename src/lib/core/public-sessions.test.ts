import { describe, expect, it } from "vitest";
import { joinBlocker, quotaLabel, rangeFor, rangeFromParams } from "./public-sessions";

const iso = (r: { from: Date; to: Date } | null) => r && [r.from.toISOString(), r.to.toISOString()];

describe("rangeFromParams", () => {
  const now = new Date("2026-10-21T01:00:00Z");
  it("today / week / date", () => {
    expect(iso(rangeFromParams("today", undefined, now))).toEqual(iso(rangeFor({ kind: "today" }, now)));
    expect(iso(rangeFromParams("week", undefined, now))).toEqual(iso(rangeFor({ kind: "week" }, now)));
    expect(rangeFromParams("date", "2026-10-24", now)?.from.toISOString()).toBe("2026-10-23T17:00:00.000Z");
  });
  it("nilai asing, tanggal kosong, atau tidak valid → null", () => {
    expect(rangeFromParams(undefined, undefined, now)).toBeNull();
    expect(rangeFromParams("semua", "2026-10-24", now)).toBeNull();
    expect(rangeFromParams("date", undefined, now)).toBeNull();
    expect(rangeFromParams("date", "2026-02-31", now)).toBeNull();
  });
});

describe("rangeFor", () => {
  it("hari ini WIB (Rabu 21 Okt 2026 08.00 WIB)", () => {
    expect(iso(rangeFor({ kind: "today" }, new Date("2026-10-21T01:00:00Z")))).toEqual([
      "2026-10-20T17:00:00.000Z",
      "2026-10-21T17:00:00.000Z",
    ]);
  });
  it("23.30 UTC sudah hari berikutnya di WIB", () => {
    expect(iso(rangeFor({ kind: "today" }, new Date("2026-10-20T23:30:00Z")))?.[0]).toBe("2026-10-20T17:00:00.000Z");
  });
  it("pekan ini Senin–Minggu", () => {
    expect(iso(rangeFor({ kind: "week" }, new Date("2026-10-21T01:00:00Z")))).toEqual([
      "2026-10-18T17:00:00.000Z", // Senin 19 Okt 00.00 WIB
      "2026-10-25T17:00:00.000Z",
    ]);
  });
  it("Minggu masih pekan yang sama; Senin mulai pekan baru", () => {
    expect(rangeFor({ kind: "week" }, new Date("2026-10-25T10:00:00Z"))?.from.toISOString()).toBe("2026-10-18T17:00:00.000Z");
    expect(rangeFor({ kind: "week" }, new Date("2026-10-25T17:00:00Z"))?.from.toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });
  it("tanggal tertentu", () => {
    expect(iso(rangeFor({ kind: "date", date: "2026-10-09" }, new Date("2026-01-01T00:00:00Z")))).toEqual([
      "2026-10-08T17:00:00.000Z",
      "2026-10-09T17:00:00.000Z",
    ]);
  });
  it("tanggal tidak valid → null", () => {
    expect(rangeFor({ kind: "date", date: "2026-02-30" }, new Date(0))).toBeNull();
    expect(rangeFor({ kind: "date", date: "besok" }, new Date(0))).toBeNull();
  });
});

describe("joinBlocker", () => {
  const now = new Date("2026-10-21T01:00:00Z");
  const future = new Date("2026-10-22T12:00:00Z");
  const past = new Date("2026-10-20T12:00:00Z");
  it("boleh bergabung", () => {
    expect(joinBlocker({ status: "planned", startsAt: future, role: "player" }, now)).toBeNull();
    expect(joinBlocker({ status: "running", startsAt: past, role: "player" }, now)).toBeNull();
  });
  it("menolak wasit", () => {
    expect(joinBlocker({ status: "planned", startsAt: future, role: "referee" }, now)).toBe("Wasit tidak bisa bergabung sebagai pemain.");
  });
  it("menolak selesai / dibatalkan / lewat / sudah bergabung", () => {
    expect(joinBlocker({ status: "finished", startsAt: past, role: "player" }, now)).toBe("Sesi ini sudah selesai.");
    expect(joinBlocker({ status: "cancelled", startsAt: future, role: "player" }, now)).toBe("Sesi ini dibatalkan.");
    expect(joinBlocker({ status: "planned", startsAt: past, role: "player" }, now)).toBe("Sesi ini sudah lewat.");
    expect(joinBlocker({ status: "planned", startsAt: future, role: "player", alreadyJoined: true }, now)).toBe("Kamu sudah bergabung di sesi ini.");
  });
});

describe("quotaLabel", () => {
  it("slot tersisa / penuh / tanpa batas", () => {
    expect(quotaLabel(5, 8)).toBe("3 slot tersisa");
    expect(quotaLabel(8, 8)).toBe("Penuh");
    expect(quotaLabel(9, 8)).toBe("Penuh");
    expect(quotaLabel(5, null)).toBe("5 pemain");
  });
});
