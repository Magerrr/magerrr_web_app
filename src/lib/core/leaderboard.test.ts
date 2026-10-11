import { describe, expect, it } from "vitest";
import {
  buildLeaderboard,
  champions,
  defaultSeasonId,
  defaultSessionId,
  monthKey,
  monthsWithMatches,
  pairMinTogether,
  parseMonthKey,
  toPeriod,
  type PeriodChoice,
} from "./leaderboard";
import type { MatchRecord } from "./types";

const OCT = new Date("2026-10-09T12:00:00Z");

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
    sessionDate: OCT,
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
const ids = (rows: { memberId: string }[]) => rows.map((r) => r.memberId);

describe("buildLeaderboard", () => {
  it("vector §2 → p2, p1, p3, p4; podium 3 teratas", () => {
    const board = buildLeaderboard(VECTOR, { winPoints: 3, lossPoints: 0 }, { kind: "all" });
    expect(ids(board.ranked)).toEqual(["p2", "p1", "p3", "p4"]);
    expect(ids(board.podium)).toEqual(["p2", "p1", "p3"]);
    expect(board.unranked).toEqual([]);
    expect(board.matchCount).toBe(3);
  });

  it("aturan poin berubah → klasemen dihitung ulang dari match yang sama", () => {
    const board = buildLeaderboard(VECTOR, { winPoints: 3, lossPoints: 0, lossBonus: { maxMargin: 3, points: 1 } }, { kind: "all" });
    expect(board.ranked.map((r) => [r.memberId, r.tablePoints])).toEqual([
      ["p2", 7],
      ["p1", 7],
      ["p3", 6],
      ["p4", 2],
    ]);
  });

  it("hanya ganda (L11); tunggal, void, dan running diabaikan", () => {
    const extra = [
      match("t1", 4, ["p4"], ["p2"], [[21, 0]], "A"),
      match("v1", 5, ["p4", "p3"], ["p1", "p2"], [[21, 0]], "A", { status: "void" }),
      match("r1", 6, ["p4", "p3"], ["p1", "p2"], [[5, 3]], "A", { status: "running", winner: null }),
    ];
    const board = buildLeaderboard([...VECTOR, ...extra], {}, { kind: "all" });
    expect(ids(board.ranked)).toEqual(["p2", "p1", "p3", "p4"]);
    expect(board.matchCount).toBe(3);
    const singles = buildLeaderboard([...VECTOR, ...extra], {}, { kind: "all" }, { kind: "singles" });
    expect(ids(singles.ranked)).toEqual(["p4", "p2"]);
  });

  it("minMatches memisahkan unranked, kecuali periode sesi", () => {
    const all = buildLeaderboard([M1], { minMatches: 2 }, { kind: "all" });
    expect(all.ranked).toEqual([]);
    expect(all.podium).toEqual([]);
    expect(ids(all.unranked)).toEqual(["p1", "p2", "p3", "p4"]);
    const session = buildLeaderboard([M1], { minMatches: 2 }, { kind: "session", sessionId: "s1" });
    expect(ids(session.ranked)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(session.ranked.map((r) => r.rank)).toEqual([1, 1, 3, 3]);
  });

  it("filter periode bulan & sesi", () => {
    const sept = match("m0", 1, ["p1", "p2"], ["p3", "p4"], [[21, 10]], "B", {
      sessionId: "s0",
      sessionDate: new Date("2026-09-30T16:59:00Z"), // 23.59 WIB, 30 Sep
    });
    const matches = [sept, ...VECTOR];
    expect(buildLeaderboard(matches, {}, { kind: "month", year: 2026, month: 10 }).matchCount).toBe(3);
    expect(buildLeaderboard(matches, {}, { kind: "month", year: 2026, month: 9 }).matchCount).toBe(1);
    expect(ids(buildLeaderboard(matches, {}, { kind: "session", sessionId: "s0" }).podium)).toEqual(["p3", "p4", "p1"]);
  });

  it("pasangan: ambang main bareng & partner terbaik", () => {
    const repeat = [
      match("a", 1, ["p1", "p2"], ["p3", "p4"], [[21, 15]], "A"),
      match("b", 2, ["p1", "p2"], ["p3", "p4"], [[21, 19]], "A"),
      match("c", 3, ["p2", "p1"], ["p3", "p4"], [[19, 21]], "B"),
    ];
    const session = buildLeaderboard(repeat, {}, { kind: "session", sessionId: "s1" }, { me: "p1" });
    expect(session.pairMin).toBe(2);
    expect(session.pairs.map((p) => [p.members, p.won, p.played])).toEqual([
      [["p1", "p2"], 2, 3],
      [["p3", "p4"], 1, 3],
    ]);
    expect(session.myBestPartner).toMatchObject({ partnerId: "p2", played: 3, won: 2 });

    const all = buildLeaderboard(repeat.slice(0, 2), {}, { kind: "all" }, { me: "p1" });
    expect(all.pairMin).toBe(3);
    expect(all.pairs).toEqual([]);
    expect(all.myBestPartner).toBeNull();
    expect(buildLeaderboard(repeat, {}, { kind: "all" }).myBestPartner).toBeNull();
  });

  it("tanpa match → kosong", () => {
    const board = buildLeaderboard([], {}, { kind: "all" }, { me: "p1" });
    expect(board).toMatchObject({ ranked: [], unranked: [], podium: [], pairs: [], myBestPartner: null, matchCount: 0 });
  });
});

describe("periode", () => {
  const base: PeriodChoice = { key: "semua", sessionId: "s1", month: { year: 2026, month: 10 }, seasonId: "x" };

  it("toPeriod", () => {
    expect(toPeriod(base)).toEqual({ kind: "all" });
    expect(toPeriod({ ...base, key: "bulan" })).toEqual({ kind: "month", year: 2026, month: 10 });
    expect(toPeriod({ ...base, key: "sesi" })).toEqual({ kind: "session", sessionId: "s1" });
    expect(toPeriod({ ...base, key: "sesi", sessionId: null })).toBeNull();
    expect(toPeriod({ ...base, key: "musim" })).toEqual({ kind: "season", seasonId: "x" });
    expect(toPeriod({ ...base, key: "musim", seasonId: null })).toBeNull();
  });

  it("pairMinTogether", () => {
    expect(pairMinTogether({ kind: "session", sessionId: "s" })).toBe(2);
    expect(pairMinTogether({ kind: "all" })).toBe(3);
  });

  it("monthKey / parseMonthKey", () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
    expect(parseMonthKey("2026-03")).toEqual({ year: 2026, month: 3 });
    for (const bad of ["2026-13", "2026-00", "2026-3", "26-03", "2026-03-01", ""]) expect(parseMonthKey(bad)).toBeNull();
  });

  it("monthsWithMatches: unik, terbaru dulu, bulan ini selalu ada", () => {
    const old = match("o", 1, ["p1", "p2"], ["p3", "p4"], [[21, 0]], "A", { sessionDate: new Date("2026-08-01T00:00:00Z") });
    const months = monthsWithMatches([old, M1, M2], { year: 2026, month: 11 });
    expect(months.map(monthKey)).toEqual(["2026-11", "2026-10", "2026-08"]);
  });
});

describe("pilihan default", () => {
  const s = (id: string, day: number, status: "planned" | "running" | "finished") => ({
    id,
    startsAt: new Date(Date.UTC(2026, 9, day, 12)),
    status,
  });

  it("defaultSessionId: berlangsung dulu, lalu sesi terbaru yang punya match", () => {
    const sessions = [s("old", 1, "finished"), s("mid", 5, "finished"), s("next", 20, "planned")];
    const matches = [match("a", 1, ["p1", "p2"], ["p3", "p4"], [[21, 0]], "A", { sessionId: "old" })];
    expect(defaultSessionId(sessions, matches)).toBe("old");
    expect(defaultSessionId([...sessions, s("run", 3, "running"), s("run2", 4, "running")], matches)).toBe("run2");
    expect(defaultSessionId(sessions, [])).toBeNull();
    expect(defaultSessionId([], matches)).toBeNull();
  });

  it("defaultSeasonId: musim terbuka terbaru, lalu musim terbaru", () => {
    expect(defaultSeasonId([])).toBeNull();
    const closed = { id: "c", startsOn: "2026-07-01", closedAt: "2026-09-30T00:00:00Z" };
    const open = { id: "o", startsOn: "2026-01-01", closedAt: null };
    expect(defaultSeasonId([closed, open])).toBe("o");
    expect(defaultSeasonId([closed, { ...open, closedAt: "x" }])).toBe("c");
    expect(defaultSeasonId([{ ...open, closedAt: "x" }, closed, { ...closed, id: "d", startsOn: "2026-07-01" }])).toBe("c");
  });
});

describe("champions", () => {
  it("peringkat 1; seri → semua; tanpa ranked → kosong", () => {
    expect(champions(buildLeaderboard(VECTOR, {}, { kind: "all" })).map((r) => r.memberId)).toEqual(["p2"]);
    expect(champions(buildLeaderboard([M1], {}, { kind: "all" })).map((r) => r.memberId)).toEqual(["p1", "p2"]);
    expect(champions(buildLeaderboard([M1], { minMatches: 2 }, { kind: "all" }))).toEqual([]);
  });
});
