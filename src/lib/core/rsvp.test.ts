import { describe, expect, it } from "vitest";
import { courtFit, summarizeRsvp } from "./rsvp";

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
