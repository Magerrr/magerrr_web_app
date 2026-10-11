import { describe, expect, it } from "vitest";
import { currentStreak, frequentOpponents, headToHead, longestWinStreak, playerMatches, recentForm, sideOf } from "./player";
import type { MatchRecord } from "./types";

function match(id: string, day: number, order: number, A: string[], B: string[], a: number, b: number, extra: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id,
    sessionId: `s${day}`,
    seasonId: null,
    sessionDate: new Date(Date.UTC(2026, 9, day, 12)),
    order,
    kind: A.length === 2 ? "doubles" : "singles",
    status: "completed",
    players: { A, B },
    games: [{ a, b }],
    winner: a > b ? "A" : "B",
    ...extra,
  };
}

// Test vector §2 (hari 9) + sesi berikutnya (hari 16). Urutan input sengaja diacak.
const M1 = match("m1", 9, 1, ["p1", "p2"], ["p3", "p4"], 21, 15);
const M2 = match("m2", 9, 2, ["p1", "p3"], ["p2", "p4"], 21, 19);
const M3 = match("m3", 9, 3, ["p1", "p4"], ["p2", "p3"], 18, 21);
const N1 = match("n1", 16, 1, ["p2", "p4"], ["p1", "p3"], 21, 10);
const N2 = match("n2", 16, 2, ["p2", "p1"], ["p3", "p4"], 21, 17);
const ALL = [N2, M3, M1, N1, M2];

describe("playerMatches", () => {
  it("kronologis: tanggal sesi, lalu urutan; hanya selesai & jenis yang diminta", () => {
    const extra = [
      match("v", 16, 3, ["p1", "p2"], ["p3", "p4"], 21, 0, { status: "void" }),
      match("r", 16, 4, ["p1", "p2"], ["p3", "p4"], 3, 1, { status: "running", winner: null }),
      match("t", 16, 5, ["p1"], ["p2"], 21, 3),
    ];
    expect(playerMatches([...ALL, ...extra], "p1").map((m) => m.id)).toEqual(["m1", "m2", "m3", "n1", "n2"]);
    expect(playerMatches([...ALL, ...extra], "p1", "singles").map((m) => m.id)).toEqual(["t"]);
    expect(playerMatches([...ALL, ...extra], "p1", null)).toHaveLength(6);
    expect(sideOf(M1, "p3")).toBe("B");
    expect(sideOf(M1, "p9")).toBeNull();
  });
});

describe("form & streak (L6)", () => {
  it("form terbaru dulu, maksimal n", () => {
    // p1: m1 W, m2 W, m3 L, n1 L, n2 W
    expect(recentForm(ALL, "p1")).toEqual(["W", "L", "L", "W", "W"]);
    expect(recentForm(ALL, "p1", 3)).toEqual(["W", "L", "L"]);
    expect(recentForm(ALL, "p9")).toEqual([]);
  });

  it("streak berjalan & terpanjang", () => {
    expect(currentStreak(ALL, "p1")).toEqual({ result: "W", length: 1 });
    // p2: m1 W, m2 L, m3 W, n1 W, n2 W
    expect(currentStreak(ALL, "p2")).toEqual({ result: "W", length: 3 });
    // p3: m1 L, m2 W, m3 W, n1 L, n2 L
    expect(currentStreak(ALL, "p3")).toEqual({ result: "L", length: 2 });
    expect(currentStreak(ALL, "p9")).toBeNull();
    expect(longestWinStreak(ALL, "p2")).toBe(3);
    expect(longestWinStreak(ALL, "p3")).toBe(2);
    expect(longestWinStreak(ALL, "p9")).toBe(0);
  });
});

describe("head-to-head (L7)", () => {
  it("hanya saat berlawanan sisi; menang & poin dari sudut a", () => {
    // p1 vs p2 berlawanan: m2 (p1 menang 21–19), m3 (p2 menang 21–18), n1 (p2 menang 21–10). m1 & n2 satu tim.
    const h = headToHead(ALL, "p1", "p2");
    expect(h).toMatchObject({ played: 3, wonA: 1, wonB: 2, pointsA: 21 + 18 + 10, pointsB: 19 + 21 + 21 });
    expect(h.matches.map((m) => m.id)).toEqual(["n1", "m3", "m2"]);
    const back = headToHead(ALL, "p2", "p1");
    expect([back.wonA, back.wonB, back.pointsA, back.pointsB]).toEqual([h.wonB, h.wonA, h.pointsB, h.pointsA]);
    expect(headToHead(ALL, "p1", "p9")).toMatchObject({ played: 0, wonA: 0, wonB: 0, matches: [] });
  });

  it("lawan tersering", () => {
    // p1 berhadapan: m1 p3,p4 · m2 p2,p4 · m3 p2,p3 · n1 p2,p4 · n2 p3,p4
    expect(frequentOpponents(ALL, "p1")).toEqual([
      { memberId: "p4", played: 4 },
      { memberId: "p2", played: 3 },
      { memberId: "p3", played: 3 },
    ]);
  });
});
