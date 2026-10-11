import { describe, expect, it } from "vitest";
import { buildPeriodRecap, previousMonth, previousSeasonId } from "./period-recap";
import type { MatchRecord } from "./types";

const OCT = new Date("2026-10-09T12:00:00Z");
const SEP = new Date("2026-09-11T12:00:00Z");

function match(id: string, order: number, A: string[], B: string[], games: [number, number][], winner: "A" | "B", extra: Partial<MatchRecord> = {}): MatchRecord {
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

// Test vector §7 (Oktober = vector §2)
const M0 = match("m0", 1, ["p4", "p3"], ["p1", "p2"], [[21, 10]], "A", { sessionId: "s0", sessionDate: SEP });
const M1 = match("m1", 1, ["p1", "p2"], ["p3", "p4"], [[21, 15]], "A");
const M2 = match("m2", 2, ["p1", "p3"], ["p2", "p4"], [[21, 19]], "A");
const M3 = match("m3", 3, ["p1", "p4"], ["p2", "p3"], [[18, 21]], "B");
const ALL = [M3, M1, M0, M2]; // urutan masukan tidak berpengaruh
const october = { kind: "month", year: 2026, month: 10 } as const;
const september = { kind: "month", year: 2026, month: 9 } as const;

describe("buildPeriodRecap (§7)", () => {
  const recap = buildPeriodRecap(ALL, {}, october, september);

  it("totals, juara, pasangan, paling banyak main & sesi", () => {
    expect(recap.totals).toEqual({ matches: 3, games: 3, sessions: 1, players: 4 });
    expect(recap.champion?.map((r) => r.memberId)).toEqual(["p2"]);
    expect(recap.podium.map((r) => r.memberId)).toEqual(["p2", "p1", "p3"]);
    expect(recap.bestPair).toBeNull();
    expect(recap.mostPlayed).toEqual({ played: 3, memberIds: ["p1", "p2", "p3", "p4"] });
    expect(recap.mostSessions).toEqual({ sessions: 1, memberIds: ["p1", "p2", "p3", "p4"] });
  });

  it("sorotan kronologis", () => {
    expect(recap.longestWinStreak).toEqual({ length: 2, memberIds: ["p1", "p3"] });
    expect(recap.tightestGame).toMatchObject({ matchId: "m2", a: 21, b: 19 });
    expect(recap.biggestWin).toMatchObject({ matchId: "m1", a: 21, b: 15 });
  });

  it("perubahan peringkat dibanding bulan sebelumnya", () => {
    expect(recap.rankChanges).toEqual([
      { memberId: "p2", rank: 1, previousRank: 3, change: 2 },
      { memberId: "p1", rank: 2, previousRank: 3, change: 1 },
      { memberId: "p3", rank: 3, previousRank: 1, change: -2 },
      { memberId: "p4", rank: 4, previousRank: 1, change: -3 },
    ]);
  });

  it("tanpa pembanding → previousRank & change null", () => {
    const solo = buildPeriodRecap(ALL, {}, october, null);
    expect(solo.rankChanges.every((r) => r.previousRank === null && r.change === null)).toBe(true);
  });

  it("streak menyambung antarsesi dalam satu periode; tunggal tidak dihitung", () => {
    const later = match("m4", 1, ["p3", "p2"], ["p1", "p4"], [[21, 5]], "A", { sessionId: "s2", sessionDate: new Date("2026-10-16T12:00:00Z") });
    const single = match("m5", 2, ["p1"], ["p2"], [[21, 0]], "A", { sessionId: "s2", sessionDate: new Date("2026-10-16T12:00:00Z") });
    const r = buildPeriodRecap([...ALL, later, single], {}, october, null);
    expect(r.longestWinStreak).toEqual({ length: 3, memberIds: ["p3"] });
    expect(r.totals).toEqual({ matches: 4, games: 4, sessions: 2, players: 4 });
    expect(r.mostSessions).toEqual({ sessions: 2, memberIds: ["p1", "p2", "p3", "p4"] });
  });

  it("periode kosong", () => {
    const empty = buildPeriodRecap(ALL, {}, { kind: "month", year: 2026, month: 8 }, null);
    expect(empty).toMatchObject({
      totals: { matches: 0, games: 0, sessions: 0, players: 0 },
      champion: null,
      podium: [],
      bestPair: null,
      tightestGame: null,
      biggestWin: null,
      longestWinStreak: null,
      mostPlayed: null,
      mostSessions: null,
      rankChanges: [],
    });
  });
});

describe("periode pembanding (§7)", () => {
  it("previousMonth melewati pergantian tahun", () => {
    expect(previousMonth({ year: 2027, month: 1 })).toEqual({ year: 2026, month: 12 });
    expect(previousMonth({ year: 2026, month: 10 })).toEqual({ year: 2026, month: 9 });
  });

  it("previousSeasonId menurut tanggal mulai", () => {
    const seasons = [
      { id: "c", startsOn: "2026-07-01" },
      { id: "a", startsOn: "2026-01-01" },
      { id: "b", startsOn: "2026-04-01" },
    ];
    expect(previousSeasonId(seasons, "c")).toBe("b");
    expect(previousSeasonId(seasons, "a")).toBeNull();
    expect(previousSeasonId(seasons, "x")).toBeNull();
  });
});
