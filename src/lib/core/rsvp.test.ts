import { describe, expect, it } from "vitest";
import { courtFit, joinBlockReason, summarizeRsvp } from "./rsvp";

describe("joinBlockReason", () => {
  const startsAt = new Date("2026-10-21T10:00:00Z");
  it("terbuka sebelum dan selama sesi", () => {
    expect(joinBlockReason({ status: "planned", startsAt, durationMin: 120 }, new Date("2026-10-21T09:00:00Z"))).toBeNull();
    expect(joinBlockReason({ status: "running", startsAt, durationMin: 120 }, new Date("2026-10-21T11:59:00Z"))).toBeNull();
  });
  it("menolak sesi selesai dan sesi yang sudah lewat", () => {
    expect(joinBlockReason({ status: "finished", startsAt, durationMin: 120 }, new Date("2026-10-21T09:00:00Z"))).toBe("Sesi ini sudah selesai.");
    expect(joinBlockReason({ status: "planned", startsAt, durationMin: 120 }, new Date("2026-10-21T12:00:00Z"))).toBe("Sesi ini sudah lewat.");
  });
});

describe("summarizeRsvp", () => {
  it("0 jawaban: semua belum menjawab", () => {
    expect(summarizeRsvp([], 5)).toEqual({ going: 0, maybe: 0, notGoing: 0, noAnswer: 5 });
  });
  it("menghitung per status", () => {
    expect(summarizeRsvp(["going", "going", "maybe", "not_going"], 6)).toEqual({ going: 2, maybe: 1, notGoing: 1, noAnswer: 2 });
  });
  it("tidak negatif", () => {
    expect(summarizeRsvp(["going", "going"], 1).noAnswer).toBe(0);
  });
});

describe("courtFit", () => {
  it("0 pemain", () => {
    expect(courtFit(2, 0)).toMatchObject({ kind: "extra", diff: 8, label: "Lebih 8 pemain" });
  });
  it("kelipatan 4 = cukup", () => {
    expect(courtFit(2, 8)).toMatchObject({ kind: "enough", label: "Cukup" });
  });
  it("kurang", () => {
    expect(courtFit(1, 6).label).toBe("Kurang 2 pemain");
  });
  it("lebih", () => {
    expect(courtFit(2, 5).label).toBe("Lebih 3 pemain");
  });
  it("lapangan 0", () => {
    expect(courtFit(0, 0).label).toBe("Cukup");
    expect(courtFit(0, 3)).toMatchObject({ kind: "short", diff: 3 });
  });
});
