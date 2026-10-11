import { describe, expect, it } from "vitest";
import { buildRecap, type RecapSession } from "@/lib/core/recap";
import type { MatchRecord } from "@/lib/core/types";
import { cardData, perPersonLabel, recapHighlights } from "./recap-view";

const match = (id: string, order: number, A: string[], B: string[], a: number, b: number): MatchRecord => ({
  id,
  sessionId: "s1",
  sessionDate: new Date("2026-10-09T12:00:00Z"),
  order,
  kind: "doubles",
  status: "completed",
  players: { A, B },
  games: [{ a, b }],
  winner: a > b ? "A" : "B",
});

// Test vector §2
const VECTOR = [
  match("m1", 1, ["p1", "p2"], ["p3", "p4"], 21, 15),
  match("m2", 2, ["p1", "p3"], ["p2", "p4"], 21, 19),
  match("m3", 3, ["p1", "p4"], ["p2", "p3"], 18, 21),
];
const NAMES = { p1: "Raka", p2: "Dimas", p3: "Sinta", p4: "Nara" };
const SESSION: RecapSession = { id: "s1", scoring: { winPoints: 3, lossPoints: 0 }, participants: ["p1", "p2", "p3", "p4"], hostId: "p1", roundTo: 500 };

describe("recapHighlights", () => {
  it("vector §2: juara p2, rally terketat 21–19, kemenangan terbesar 21–15, streak, paling banyak main", () => {
    const highlights = recapHighlights(buildRecap(SESSION, VECTOR, []), NAMES);
    expect(highlights).toEqual([
      { key: "champion", title: "Juara sesi", value: "Dimas", detail: "2 menang dari 3 main · 6 poin" },
      { key: "tightestGame", title: "Rally terketat", value: "21–19", detail: "Raka / Sinta atas Dimas / Nara" },
      { key: "biggestWin", title: "Kemenangan terbesar", value: "21–15", detail: "Raka / Dimas atas Sinta / Nara" },
      { key: "longestWinStreak", title: "Win streak terpanjang", value: "2 beruntun", detail: "Raka & Sinta" },
      { key: "mostPlayed", title: "Paling banyak main", value: "3 match", detail: "Raka & Dimas & Sinta & Nara" },
    ]);
  });

  it("juara bersama, pasangan terbaik, sisi B menang; satu game → tanpa kemenangan terbesar, streak 1 disembunyikan", () => {
    const one = [match("x", 1, ["p1", "p2"], ["p3", "p4"], 19, 21)];
    const h = recapHighlights(buildRecap(SESSION, one, []), NAMES);
    expect(h.map((x) => x.key)).toEqual(["champion", "tightestGame", "mostPlayed"]);
    expect(h[0]).toMatchObject({ title: "Juara bersama", value: "Sinta & Nara" });
    expect(h[1]).toMatchObject({ value: "21–19", detail: "Sinta / Nara atas Raka / Dimas" });

    const pair = [match("a", 1, ["p1", "p2"], ["p3", "p4"], 21, 10), match("b", 2, ["p1", "p2"], ["p3", "p4"], 21, 12)];
    expect(recapHighlights(buildRecap(SESSION, pair, []), NAMES).find((x) => x.key === "bestPair")).toEqual({
      key: "bestPair",
      title: "Pasangan terbaik",
      value: "Raka & Dimas",
      detail: "2 menang dari 2 main bareng",
    });
  });

  it("tanpa match → tanpa kartu", () => {
    expect(recapHighlights(buildRecap(SESSION, [], []), NAMES)).toEqual([]);
  });
});

describe("perPersonLabel", () => {
  it("seragam, rentang, tanpa biaya", () => {
    const expense = (amount: number) => ({ id: "e", amount, paidBy: "p1", mode: "equal" as const });
    expect(perPersonLabel(buildRecap(SESSION, [], [expense(140000)]))).toBe("Rp35.000/orang");
    expect(perPersonLabel(buildRecap({ ...SESSION, roundTo: 1 }, [], [expense(100003)]))).toBe("Rp25.000–Rp25.001/orang");
    expect(perPersonLabel(buildRecap(SESSION, [], []))).toBeNull();
  });
});

describe("cardData", () => {
  const header = { groupName: "Mabar", subtitle: "Jumat" };
  it("vector §2 + biaya: juara, skor tertipis, jumlah match, patungan", () => {
    const expense = { id: "e", amount: 140000, paidBy: "p1", mode: "equal" as const };
    expect(cardData(buildRecap(SESSION, VECTOR, [expense]), NAMES, header)).toEqual({
      ...header,
      champion: { title: "Juara sesi", value: "Dimas", detail: "2 menang dari 3 main · 6 poin" },
      stats: [
        { label: "Skor tertipis", value: "21–19", detail: "Raka / Sinta atas Dimas / Nara" },
        { label: "Jumlah match", value: "3 match", detail: "3 game" },
        { label: "Patungan", value: "Rp35.000/orang", detail: "Total Rp140.000" },
      ],
    });
  });

  it("sesi kosong: hanya jumlah match", () => {
    expect(cardData(buildRecap(SESSION, [], []), NAMES, header)).toEqual({
      ...header,
      champion: null,
      stats: [{ label: "Jumlah match", value: "0 match", detail: "0 game" }],
    });
  });
});
