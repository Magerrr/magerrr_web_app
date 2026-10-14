import { describe, expect, it } from "vitest";
import { PRESETS } from "./rules";
import { addPoint, courtEnds, currentGame, pointStatus, removePoint, sideChange } from "./scoring";
import type { GameScore } from "./types";

const bwf21 = PRESETS.bwf21;
const one = { games: 1 };
const bo3 = { games: 3 };
const tap = (games: GameScore[], sides: string, format = one) =>
  [...sides].reduce((g, s) => addPoint(g, s as "A" | "B", bwf21, format), games);

describe("addPoint — input tap (SC2) dengan game selesai otomatis (SC3)", () => {
  it("20–20 lanjut (deuce) sampai 22–20 menutup game", () => {
    let games: GameScore[] = [{ a: 20, b: 20 }];
    games = tap(games, "A");
    expect(games).toEqual([{ a: 21, b: 20 }]);
    games = tap(games, "A");
    expect(games).toEqual([{ a: 22, b: 20 }]);
    // match 1 game sudah selesai → tap berikutnya diabaikan
    expect(tap(games, "B")).toBe(games);
  });

  it("30–29 menutup game di batas maksimum", () => {
    expect(tap([{ a: 29, b: 29 }], "B")).toEqual([{ a: 29, b: 30 }]);
  });

  it("best of 3: game selesai membuka game berikutnya 0–0, match selesai tidak", () => {
    const g1 = tap([{ a: 20, b: 3 }], "A", bo3);
    expect(g1).toEqual([{ a: 21, b: 3 }, { a: 0, b: 0 }]);
    const g2 = tap([{ a: 21, b: 3 }, { a: 20, b: 1 }], "A", bo3);
    expect(g2).toEqual([{ a: 21, b: 3 }, { a: 21, b: 1 }]);
  });

  it("game terakhir sudah selesai tanpa game baru → poin masuk ke game baru", () => {
    expect(addPoint([{ a: 21, b: 3 }], "B", bwf21, bo3)).toEqual([{ a: 21, b: 3 }, { a: 0, b: 1 }]);
  });

  it("tidak mengubah array masukan", () => {
    const games = [{ a: 1, b: 0 }];
    tap(games, "A");
    expect(games).toEqual([{ a: 1, b: 0 }]);
  });
});

describe("removePoint", () => {
  it("−1 di game berjalan; tidak di bawah 0", () => {
    expect(removePoint([{ a: 5, b: 3 }], "B", bwf21)).toEqual([{ a: 5, b: 2 }]);
    expect(removePoint([{ a: 0, b: 3 }], "A", bwf21)).toEqual([{ a: 0, b: 3 }]);
  });

  it("game baru 0–0 → kembali ke game sebelumnya dan kurangi poin di sana", () => {
    expect(removePoint([{ a: 21, b: 3 }, { a: 0, b: 0 }], "A", bwf21)).toEqual([{ a: 20, b: 3 }]);
  });

  it("game baru 0–0, −1 untuk sisi yang kalah di game sebelumnya → diabaikan", () => {
    const games = [{ a: 21, b: 3 }, { a: 0, b: 0 }];
    expect(removePoint(games, "B", bwf21)).toBe(games);
  });

  it("match selesai bisa dibuka lagi dengan −1", () => {
    expect(removePoint([{ a: 22, b: 20 }], "A", bwf21)).toEqual([{ a: 21, b: 20 }]);
  });
});

describe("currentGame", () => {
  it("nomor game aktif (1-based) dan skornya", () => {
    expect(currentGame([{ a: 21, b: 3 }, { a: 4, b: 2 }])).toEqual({ no: 2, a: 4, b: 2 });
  });
});

describe("pointStatus — game point / match point (SC5, ALGORITHMS §1b)", () => {
  const g = (...pairs: [number, number][]) => pairs.map(([a, b]) => ({ a, b }));
  it.each([
    [g([20, 15]), one, { A: "match", B: null }],
    [g([20, 15]), bo3, { A: "game", B: null }],
    [g([21, 15], [19, 20]), bo3, { A: null, B: "game" }],
    [g([21, 15], [20, 19]), bo3, { A: "match", B: null }],
    [g([29, 29]), one, { A: "match", B: "match" }],
    [g([20, 20]), one, { A: null, B: null }],
    [g([22, 20]), one, { A: null, B: null }],
    [g([21, 15]), bo3, { A: null, B: null }],
  ])("%j games=%j → %j", (games, format, expected) => {
    expect(pointStatus(games, bwf21, format)).toEqual(expected);
  });

  it("tanpa deuce: 14–14 target 15 → kedua sisi match point", () => {
    expect(pointStatus(g([14, 14]), { target: 15, deuce: false, cap: 15 }, one)).toEqual({ A: "match", B: "match" });
  });
});

describe("sideChange — ganti sisi (SC5, ALGORITHMS §1b)", () => {
  const g = (...pairs: [number, number][]) => pairs.map(([a, b]) => ({ a, b }));
  it.each([
    [g([10, 5]), g([11, 5]), one, "interval"],
    [g([10, 5]), g([11, 5]), bo3, null],
    [g([21, 15], [15, 21], [10, 8]), g([21, 15], [15, 21], [11, 8]), bo3, "interval"],
    [g([11, 5]), g([11, 6]), one, null],
    [g([11, 5]), g([10, 5]), one, null],
    [g([20, 15]), g([21, 15], [0, 0]), bo3, "game"],
    [g([21, 15], [20, 15]), g([21, 15], [21, 15]), bo3, null],
  ])("%j → %j games=%j → %s", (before, after, format, expected) => {
    expect(sideChange(before, after, bwf21, format)).toBe(expected);
  });

  it("poin15: interval di 8", () => {
    expect(sideChange(g([7, 7]), g([8, 7]), PRESETS.poin15, one)).toBe("interval");
  });

  it("mengikuti addPoint: tap yang menutup game memberi 'game'", () => {
    const before = g([20, 3]);
    expect(sideChange(before, addPoint(before, "A", bwf21, bo3), bwf21, bo3)).toBe("game");
  });
});

describe("courtEnds — sisi kiri lapangan (ALGORITHMS §1c)", () => {
  const vectors: [GameScore[], number, "A" | "B"][] = [
    [[{ a: 0, b: 0 }], 1, "A"],
    [[{ a: 10, b: 5 }], 1, "A"],
    [[{ a: 11, b: 5 }], 1, "B"],
    [[{ a: 11, b: 5 }], 3, "A"],
    [[{ a: 21, b: 15 }, { a: 0, b: 0 }], 3, "B"],
    [[{ a: 21, b: 15 }], 3, "B"],
    [[{ a: 21, b: 15 }, { a: 15, b: 21 }, { a: 10, b: 8 }], 3, "A"],
    [[{ a: 21, b: 15 }, { a: 15, b: 21 }, { a: 8, b: 11 }], 3, "B"],
    [[{ a: 21, b: 15 }, { a: 21, b: 15 }], 3, "B"],
    [[{ a: 21, b: 15 }, { a: 15, b: 21 }, { a: 21, b: 19 }], 3, "B"],
    [[{ a: 21, b: 15 }], 1, "B"],
  ];
  it.each(vectors)("%j best of %i → kiri %s", (games, n, left) => {
    expect(courtEnds(games, bwf21, { games: n })).toBe(left);
  });

  it("poin15: game penentu pindah sisi di 8", () => {
    expect(courtEnds([{ a: 7, b: 7 }], PRESETS.poin15, one)).toBe("A");
    expect(courtEnds([{ a: 8, b: 7 }], PRESETS.poin15, one)).toBe("B");
  });
});
