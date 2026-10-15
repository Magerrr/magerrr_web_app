import { describe, expect, it } from "vitest";
import { canPlay, playersOf } from "./roles";

describe("canPlay (MAGERRR-11: wasit mengurus permainan, tidak ikut main)", () => {
  it("admin dan pemain boleh main, wasit tidak", () => {
    expect(canPlay("admin")).toBe(true);
    expect(canPlay("member")).toBe(true);
    expect(canPlay("referee")).toBe(false);
  });
});

describe("playersOf", () => {
  const members = [
    { id: "a", role: "admin" as const },
    { id: "w", role: "referee" as const },
    { id: "b", role: "member" as const },
  ];

  it("membuang wasit dan menjaga urutan", () => {
    expect(playersOf(members).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("daftar kosong tetap kosong", () => {
    expect(playersOf([])).toEqual([]);
  });
});
