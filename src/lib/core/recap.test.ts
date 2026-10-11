import { describe, expect, it } from "vitest";
import { buildRecap, type RecapSession } from "./recap";
import type { Expense } from "./split";
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

const PEOPLE = ["p1", "p2", "p3", "p4"];
const session: RecapSession = {
  id: "s1",
  scoring: { winPoints: 3, lossPoints: 0 },
  participants: PEOPLE,
  hostId: "p1",
  roundTo: 500,
};

describe("buildRecap — data vector §2", () => {
  const recap = buildRecap(session, [M3, M1, M2], []);

  it("juara = p2", () => {
    expect(recap.champion?.map((r) => r.memberId)).toEqual(["p2"]);
  });

  it("pasangan terbaik null (tak ada pasangan main >= 2)", () => {
    expect(recap.bestPair).toBeNull();
  });

  it("game tertipis 21–19 (M2), kemenangan terbesar 21–15 (M1)", () => {
    expect(recap.tightestGame).toMatchObject({ matchId: "m2", gameNo: 1, a: 21, b: 19, margin: 2, winner: "A" });
    expect(recap.biggestWin).toMatchObject({ matchId: "m1", a: 21, b: 15, margin: 6 });
    expect(recap.biggestWin?.players).toEqual({ A: ["p1", "p2"], B: ["p3", "p4"] });
  });

  it("win streak terpanjang 2: p1 (M1, M2) dan p3 (M2, M3)", () => {
    expect(recap.longestWinStreak).toEqual({ length: 2, memberIds: ["p1", "p3"] });
  });

  it("paling banyak main: semua (3)", () => {
    expect(recap.mostPlayed).toEqual({ played: 3, memberIds: PEOPLE });
  });

  it("totals tanpa biaya", () => {
    expect(recap.totals).toEqual({
      matches: 3,
      games: 3,
      cost: 0,
      perPerson: null,
      paid: 0,
      settlements: 0,
    });
  });
});

describe("buildRecap — tambahan", () => {
  it("sesi tanpa match & biaya → field null, tanpa error", () => {
    const recap = buildRecap({ ...session, participants: [] }, [], []);
    expect(recap).toEqual({
      champion: null,
      bestPair: null,
      tightestGame: null,
      biggestWin: null,
      longestWinStreak: null,
      mostPlayed: null,
      totals: { matches: 0, games: 0, cost: 0, perPerson: null, paid: 0, settlements: 0 },
    });
  });

  it("hanya match completed di sesi ini yang dihitung", () => {
    const recap = buildRecap(
      session,
      [
        M1,
        { ...M2, status: "void" },
        { ...M3, status: "running", winner: null },
        { ...M2, id: "lain", sessionId: "s2" },
      ],
      [],
    );
    expect(recap.totals.matches).toBe(1);
    expect(recap.champion?.map((r) => r.memberId)).toEqual(["p1", "p2"]);
  });

  it("pasangan terbaik bila ada yang main >= 2", () => {
    const M4 = match("m4", 4, ["p1", "p2"], ["p3", "p4"], [[21, 10]], "A");
    const recap = buildRecap(session, [M1, M2, M3, M4], []);
    expect(recap.bestPair).toMatchObject({ members: ["p1", "p2"], played: 2, won: 2, pointDiff: 17 });
  });

  it("game tertipis seri → game terbaru; best of 3 dihitung per game", () => {
    const a = match("a", 1, ["p1"], ["p2"], [[21, 19]], "A");
    const b = match("b", 2, ["p3"], ["p4"], [[19, 21], [22, 20], [21, 12]], "A");
    const recap = buildRecap(session, [a, b], []);
    expect(recap.tightestGame).toMatchObject({ matchId: "b", gameNo: 2, a: 22, b: 20 });
    expect(recap.biggestWin).toMatchObject({ matchId: "b", gameNo: 3, margin: 9 });
    expect(recap.totals.games).toBe(4);
  });

  it("juara mengabaikan minMatches grup", () => {
    const recap = buildRecap({ ...session, scoring: { minMatches: 10 } }, [M1, M2, M3], []);
    expect(recap.champion?.map((r) => r.memberId)).toEqual(["p2"]);
  });

  it("totals patungan: vector §5 #1 & status lunas", () => {
    const eight = ["raka", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    const expenses: Expense[] = [
      { id: "lapangan", amount: 240_000, paidBy: "raka", mode: "equal" },
      { id: "kok", amount: 40_000, paidBy: "raka", mode: "equal" },
    ];
    const recap = buildRecap(
      {
        id: "s1",
        participants: eight,
        hostId: "raka",
        roundTo: 500,
        settlements: [{ status: "paid" }, { status: "paid" }, { status: "unpaid" }],
      },
      [],
      expenses,
    );
    expect(recap.totals.cost).toBe(280_000);
    expect(recap.totals.perPerson).toEqual(Object.fromEntries(eight.slice(1).map((id) => [id, 35_000])));
    expect(recap.totals).toMatchObject({ paid: 2, settlements: 3 });
  });
});
