import { describe, expect, it } from "vitest";
import {
  bestPartner,
  partnersOf,
  inPeriod,
  jakartaMonth,
  pairStats,
  standings,
  type StandingRow,
} from "./standings";
import type { MatchRecord } from "./types";

const DATE = new Date("2026-10-09T12:00:00Z");

function match(
  id: string,
  order: number,
  A: string[],
  B: string[],
  games: [number, number][],
  winner: "A" | "B",
  extra: Partial<MatchRecord> = {},
): MatchRecord {
  return {
    id,
    sessionId: "s1",
    seasonId: null,
    sessionDate: DATE,
    order,
    kind: A.length === 2 ? "doubles" : "singles",
    status: "completed",
    players: { A, B },
    games: games.map(([a, b]) => ({ a, b })),
    winner,
    ...extra,
  };
}

// Test vector §2
const M1 = match("m1", 1, ["p1", "p2"], ["p3", "p4"], [[21, 15]], "A");
const M2 = match("m2", 2, ["p1", "p3"], ["p2", "p4"], [[21, 19]], "A");
const M3 = match("m3", 3, ["p1", "p4"], ["p2", "p3"], [[18, 21]], "B");
const VECTOR = [M1, M2, M3];

const pick = (rows: StandingRow[]) =>
  rows.map(({ memberId, played, won, lost, pointsFor, pointsAgainst, pointDiff, tablePoints }) => ({
    memberId,
    played,
    won,
    lost,
    pointsFor,
    pointsAgainst,
    pointDiff,
    tablePoints,
  }));

describe("standings — test vector §2", () => {
  it("kolom & urutan p2, p1, p3, p4", () => {
    const rows = standings(VECTOR, { winPoints: 3, lossPoints: 0 }, { kind: "all" });
    expect(pick(rows)).toEqual([
      { memberId: "p2", played: 3, won: 2, lost: 1, pointsFor: 61, pointsAgainst: 54, pointDiff: 7, tablePoints: 6 },
      { memberId: "p1", played: 3, won: 2, lost: 1, pointsFor: 60, pointsAgainst: 55, pointDiff: 5, tablePoints: 6 },
      { memberId: "p3", played: 3, won: 2, lost: 1, pointsFor: 57, pointsAgainst: 58, pointDiff: -1, tablePoints: 6 },
      { memberId: "p4", played: 3, won: 0, lost: 3, pointsFor: 52, pointsAgainst: 63, pointDiff: -11, tablePoints: 0 },
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.every((r) => r.ranked)).toBe(true);
    expect(rows[0].winRate).toBeCloseTo(2 / 3);
    expect(rows[3].winRate).toBe(0);
  });

  it("invarian Σ pointsFor = Σ pointsAgainst = 230", () => {
    const rows = standings(VECTOR, { winPoints: 3, lossPoints: 0 }, { kind: "all" });
    const sum = (k: "pointsFor" | "pointsAgainst") => rows.reduce((s, r) => s + r[k], 0);
    expect(sum("pointsFor")).toBe(230);
    expect(sum("pointsAgainst")).toBe(230);
  });

  it("lossBonus {maxMargin 3, points 1} → p1=7, p2=7, p3=6, p4=2, urutan p2, p1, p3, p4", () => {
    const rows = standings(
      VECTOR,
      { winPoints: 3, lossPoints: 0, lossBonus: { maxMargin: 3, points: 1 } },
      { kind: "all" },
    );
    expect(rows.map((r) => [r.memberId, r.tablePoints])).toEqual([
      ["p2", 7],
      ["p1", 7],
      ["p3", 6],
      ["p4", 2],
    ]);
  });

  it("minMatches=4 → semua ranked=false", () => {
    const rows = standings(VECTOR, { winPoints: 3, lossPoints: 0, minMatches: 4 }, { kind: "all" });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => !r.ranked && r.rank === null)).toBe(true);
    expect(rows.map((r) => r.memberId)).toEqual(["p2", "p1", "p3", "p4"]);
  });

  it("period session hanya M1 → p1, p2 berbagi peringkat 1 (3 poin, +6), urut id", () => {
    const other = { ...M2, sessionId: "s2" };
    const rows = standings([M1, other], { winPoints: 3, lossPoints: 0 }, { kind: "session", sessionId: "s1" });
    expect(rows.map((r) => [r.memberId, r.rank, r.tablePoints, r.pointDiff])).toEqual([
      ["p1", 1, 3, 6],
      ["p2", 1, 3, 6],
      ["p3", 3, 0, -6],
      ["p4", 3, 0, -6],
    ]);
  });
});

describe("standings — tambahan", () => {
  it("match void/running diabaikan", () => {
    const rows = standings(
      [M1, { ...M2, status: "void" }, { ...M3, status: "running", winner: null }],
      {},
      { kind: "all" },
    );
    expect(rows.every((r) => r.played === 1)).toBe(true);
  });

  it("poin klasemen dapat diubah tanpa mengubah data match", () => {
    const rows = standings(VECTOR, { winPoints: 2, lossPoints: 1 }, { kind: "all" });
    expect(rows.find((r) => r.memberId === "p4")?.tablePoints).toBe(3);
    expect(rows.find((r) => r.memberId === "p2")?.tablePoints).toBe(5);
  });

  it("default config = 3/0 tanpa bonus", () => {
    const rows = standings(VECTOR);
    expect(rows.map((r) => r.tablePoints)).toEqual([6, 6, 6, 0]);
  });

  it("pemain ranked di atas yang belum memenuhi minMatches meski poinnya lebih kecil", () => {
    const extra = match("m4", 4, ["p4", "p5"], ["p6", "p7"], [[21, 0]], "A");
    const rows = standings([...VECTOR, extra], { minMatches: 2 }, { kind: "all" });
    expect(rows.slice(0, 4).map((r) => r.memberId)).toEqual(["p2", "p1", "p3", "p4"]);
    expect(rows[3]).toMatchObject({ memberId: "p4", ranked: true, rank: 4 });
    expect(rows.slice(4).map((r) => [r.memberId, r.ranked, r.rank])).toEqual([
      ["p5", false, null],
      ["p6", false, null],
      ["p7", false, null],
    ]);
  });

  it("win rate memisahkan bila poin klasemen sama", () => {
    // a: 1 main 1 menang (3 poin, 100%); b & y: 2 main 1 menang (3 poin, 50%, selisih 0)
    const ms = [
      match("x1", 1, ["a"], ["z"], [[21, 19]], "A"),
      match("x2", 2, ["b"], ["y"], [[21, 0]], "A"),
      match("x3", 3, ["b"], ["y"], [[0, 21]], "B"),
    ];
    const rows = standings(ms, {}, { kind: "all" });
    expect(rows.map((r) => [r.memberId, r.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["y", 2],
      ["z", 4],
    ]);
  });

  it("selisih poin didahulukan sebelum jumlah main", () => {
    const ms = [
      match("x1", 1, ["a"], ["z"], [[21, 0]], "A"),
      match("x2", 2, ["a"], ["z"], [[19, 21]], "B"),
      match("x3", 3, ["b"], ["y"], [[21, 19]], "A"),
      match("x4", 4, ["b"], ["y"], [[19, 21]], "B"),
      match("x5", 5, ["b"], ["y"], [[21, 19]], "A"),
      match("x6", 6, ["b"], ["y"], [[19, 21]], "B"),
    ];
    // semua 0 poin & 50%; a +19 (main 2), b & y 0 (main 4), z −19 (main 2)
    const rows = standings(ms, { winPoints: 0, lossPoints: 0 }, { kind: "all" });
    expect(rows.map((r) => r.memberId)).toEqual(["a", "b", "y", "z"]);
  });

  it("jumlah main memisahkan bila poin, win rate, dan selisih sama", () => {
    const ms = [
      match("x1", 1, ["a"], ["z"], [[21, 19]], "A"),
      match("x2", 2, ["a"], ["z"], [[19, 21]], "B"),
      match("x3", 3, ["b"], ["y"], [[21, 19]], "A"),
      match("x4", 4, ["b"], ["y"], [[19, 21]], "B"),
      match("x5", 5, ["b"], ["y"], [[21, 19]], "A"),
      match("x6", 6, ["b"], ["y"], [[19, 21]], "B"),
    ];
    // semua 0 poin, 50%, selisih 0; b & y main 4, a & z main 2
    const rows = standings(ms, { winPoints: 0, lossPoints: 0 }, { kind: "all" });
    expect(rows.map((r) => [r.memberId, r.rank])).toEqual([
      ["b", 1],
      ["y", 1],
      ["a", 3],
      ["z", 3],
    ]);
  });
});

describe("period", () => {
  it("bulan dihitung di Asia/Jakarta", () => {
    // 30 Sep 18:00 UTC = 1 Okt 01:00 WIB
    expect(jakartaMonth(new Date("2026-09-30T18:00:00Z"))).toEqual({ year: 2026, month: 10 });
    expect(jakartaMonth(new Date("2026-09-30T16:59:59Z"))).toEqual({ year: 2026, month: 9 });
    expect(jakartaMonth(new Date("2026-12-31T17:00:00Z"))).toEqual({ year: 2027, month: 1 });
  });

  it("filter month, season, session, all", () => {
    const m = { ...M1, seasonId: "season-1", sessionDate: new Date("2026-09-30T18:00:00Z") };
    expect(inPeriod(m, { kind: "month", year: 2026, month: 10 })).toBe(true);
    expect(inPeriod(m, { kind: "month", year: 2026, month: 9 })).toBe(false);
    expect(inPeriod(m, { kind: "season", seasonId: "season-1" })).toBe(true);
    expect(inPeriod(M1, { kind: "season", seasonId: "season-1" })).toBe(false);
    expect(inPeriod(m, { kind: "session", sessionId: "s1" })).toBe(true);
    expect(inPeriod(m, { kind: "all" })).toBe(true);
  });

  it("standings memakai filter periode", () => {
    const sept = { ...M3, sessionDate: new Date("2026-09-15T12:00:00Z") };
    const rows = standings([M1, M2, sept], {}, { kind: "month", year: 2026, month: 10 });
    expect(rows.every((r) => r.played === 2)).toBe(true);
  });
});

describe("partnersOf (§3, L10)", () => {
  it("vector §2: semua partner, urut main ↓, win rate ↓, selisih ↓", () => {
    const pairs = pairStats(VECTOR);
    expect(partnersOf(pairs, "p1").map((p) => [p.partnerId, p.won, p.lost, p.pointDiff])).toEqual([
      ["p2", 1, 0, 6],
      ["p3", 1, 0, 2],
      ["p4", 0, 1, -3],
    ]);
    expect(partnersOf(pairs, "p3").map((p) => [p.partnerId, p.pointDiff])).toEqual([
      ["p2", 3],
      ["p1", 2],
      ["p4", -6],
    ]);
    expect(partnersOf(pairs, "p9")).toEqual([]);
  });

  it("lebih sering main bareng di atas", () => {
    const pairs = pairStats([M1, match("x", 9, ["p1", "p3"], ["p2", "p4"], [[21, 5]], "A"), match("y", 10, ["p1", "p2"], ["p3", "p4"], [[10, 21]], "B")]);
    expect(partnersOf(pairs, "p1").map((p) => p.partnerId)).toEqual(["p2", "p3"]);
  });
});

describe("pairStats & bestPartner (§3)", () => {
  const M4 = match("m4", 4, ["p1", "p2"], ["p3", "p4"], [[21, 10]], "A");
  const M5 = match("m5", 5, ["p2", "p1"], ["p4", "p3"], [[15, 21]], "B");
  const single = match("m6", 6, ["p1"], ["p2"], [[21, 3]], "A");

  it("pasangan terurut (minId, maxId), tunggal tidak dihitung", () => {
    const pairs = pairStats([M1, M4, M5, single]);
    const p12 = pairs.find((p) => p.members[0] === "p1" && p.members[1] === "p2");
    expect(p12).toMatchObject({ played: 3, won: 2, lost: 1, pointDiff: 6 + 11 - 6 });
    const p34 = pairs.find((p) => p.members.join() === "p3,p4");
    expect(p34).toMatchObject({ played: 3, won: 1, lost: 2, pointDiff: -11 });
    expect(pairs).toHaveLength(2);
  });

  it("vector §2: tiap pasangan main sekali", () => {
    const pairs = pairStats(VECTOR);
    expect(pairs).toHaveLength(6);
    expect(pairs.every((p) => p.played === 1)).toBe(true);
    expect(pairs[0]).toMatchObject({ members: ["p1", "p2"], won: 1, pointDiff: 6 });
  });

  it("bestPartner butuh minTogether, tie-break pointDiff lalu id", () => {
    const pairs = pairStats([M1, M4, M5]);
    expect(bestPartner(pairs, "p1")).toMatchObject({ partnerId: "p2", played: 3, won: 2 });
    expect(bestPartner(pairs, "p1", 4)).toBeNull();
    expect(bestPartner(pairs, "p9")).toBeNull();

    const tie = pairStats([
      match("t1", 1, ["a", "c"], ["x", "y"], [[21, 10]], "A"),
      match("t2", 2, ["a", "b"], ["x", "y"], [[21, 10]], "A"),
      match("t3", 3, ["a", "d"], ["x", "y"], [[21, 5]], "A"),
    ]);
    expect(bestPartner(tie, "a", 1)?.partnerId).toBe("d");
    expect(bestPartner(tie.filter((p) => !p.members.includes("d")), "a", 1)?.partnerId).toBe("b");
  });
});
