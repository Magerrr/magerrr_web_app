import { describe, expect, it } from "vitest";
import { canScore, scorerRefusal } from "./scorer";

const admin = { id: "h", isOfficial: true };
const budi = { id: "b", isOfficial: false };
const cici = { id: "c", isOfficial: false };
/** wasit (MAGERRR-11): pengurus permainan seperti admin */
const wasit = { id: "w", isOfficial: true };
const present = ["h", "b", "c"];

describe("canScore (ALGORITHMS §1d)", () => {
  it("tanpa pencatat hanya admin", () => {
    expect(canScore(null, admin)).toBe(true);
    expect(canScore(null, budi)).toBe(false);
  });

  it("dengan pencatat hanya pencatat itu, admin pun tidak", () => {
    expect(canScore("b", budi)).toBe(true);
    expect(canScore("b", cici)).toBe(false);
    expect(canScore("b", admin)).toBe(false);
    expect(canScore("h", admin)).toBe(true);
  });
});

describe("wasit (ALGORITHMS §1d)", () => {
  it("wasit mencatat lapangan tanpa pencatat dan menunjuk/mencabut seperti admin", () => {
    expect(canScore(null, wasit)).toBe(true);
    expect(canScore("b", wasit)).toBe(false);
    expect(scorerRefusal("b", "c", wasit, present)).toBeNull();
    expect(scorerRefusal("b", null, wasit, present)).toBeNull();
    expect(scorerRefusal(null, "x", wasit, present)).toBe("not_present");
  });
});

describe("scorerRefusal (ALGORITHMS §1d)", () => {
  it("admin menunjuk, mengganti, atau mengosongkan", () => {
    expect(scorerRefusal(null, "b", admin, present)).toBeNull();
    expect(scorerRefusal("b", "c", admin, present)).toBeNull();
    expect(scorerRefusal("b", null, admin, present)).toBeNull();
    expect(scorerRefusal("b", "h", admin, present)).toBeNull();
  });

  it("hanya peserta hadir yang bisa jadi pencatat", () => {
    expect(scorerRefusal(null, "x", admin, present)).toBe("not_present");
    expect(scorerRefusal(null, "x", { id: "x", isOfficial: false }, present)).toBe("not_present");
  });

  it("pemain mengajukan diri hanya saat lapangan kosong pencatat", () => {
    expect(scorerRefusal(null, "b", budi, present)).toBeNull();
    expect(scorerRefusal("b", "b", budi, present)).toBeNull();
    expect(scorerRefusal("c", "b", budi, present)).toBe("taken");
  });

  it("pemain tidak bisa menunjuk orang lain atau melepas kontrol orang lain", () => {
    expect(scorerRefusal(null, "c", budi, present)).toBe("not_allowed");
    expect(scorerRefusal("c", null, budi, present)).toBe("not_allowed");
    expect(scorerRefusal("b", null, budi, present)).toBeNull();
    expect(scorerRefusal(null, null, budi, present)).toBeNull();
  });
});
