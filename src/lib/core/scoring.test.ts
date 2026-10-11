import { describe, expect, it } from "vitest";
import { PRESETS } from "./rules";
import { addPoint, currentGame, removePoint } from "./scoring";
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
