import { describe, expect, it } from "vitest";
import { PRESETS, assertValidRules, checkGames, gameWinner, isFinalScore, matchWinner, type GameRules } from "./rules";

const bwf21 = PRESETS.bwf21;
const poin15NoDeuce: GameRules = { target: 15, deuce: false, cap: 15 };
const poin15 = PRESETS.poin15;

describe("PRESETS (§0)", () => {
  it("nilai preset sesuai spesifikasi", () => {
    expect(PRESETS).toEqual({
      bwf21: { target: 21, deuce: true, cap: 30 },
      poin15: { target: 15, deuce: true, cap: 21 },
      poin11: { target: 11, deuce: true, cap: 15 },
    });
  });
});

describe("gameWinner — test vector §1", () => {
  it.each([
    [21, 19, bwf21, "A"],
    [21, 20, bwf21, null],
    [22, 20, bwf21, "A"],
    [20, 20, bwf21, null],
    [29, 29, bwf21, null],
    [30, 29, bwf21, "A"],
    [29, 30, bwf21, "B"],
    [21, 0, bwf21, "A"],
    [0, 0, bwf21, null],
    [15, 14, poin15NoDeuce, "A"],
    [15, 14, poin15, null],
    [16, 14, poin15, "A"],
  ] as const)("%i–%i → %s", (a, b, rules, expected) => {
    expect(gameWinner(a, b, rules)).toBe(expected);
  });
});

describe("gameWinner — tambahan", () => {
  it("simetris untuk sisi B", () => {
    expect(gameWinner(19, 21, bwf21)).toBe("B");
    expect(gameWinner(20, 22, bwf21)).toBe("B");
    expect(gameWinner(14, 15, poin15NoDeuce)).toBe("B");
  });

  it("poin11 ditutup di cap 15", () => {
    expect(gameWinner(15, 14, PRESETS.poin11)).toBe("A");
    expect(gameWinner(14, 14, PRESETS.poin11)).toBeNull();
  });

  it("skor negatif atau pecahan → RangeError", () => {
    expect(() => gameWinner(-1, 0, bwf21)).toThrow(RangeError);
    expect(() => gameWinner(0, 1.5, bwf21)).toThrow(RangeError);
    expect(() => gameWinner(Number.NaN, 0, bwf21)).toThrow(RangeError);
  });

  it("skor yang membuat kedua sisi menang → RangeError", () => {
    expect(() => gameWinner(30, 30, bwf21)).toThrow(RangeError);
    expect(() => gameWinner(15, 15, poin15NoDeuce)).toThrow(RangeError);
  });
});

describe("assertValidRules", () => {
  it("menerima preset dan kustom >= 5", () => {
    for (const rules of Object.values(PRESETS)) expect(() => assertValidRules(rules)).not.toThrow();
    expect(() => assertValidRules({ target: 5, deuce: false, cap: 5 })).not.toThrow();
  });

  it("menolak target < 5, pecahan, atau cap < target saat deuce", () => {
    expect(() => assertValidRules({ target: 4, deuce: false, cap: 4 })).toThrow(RangeError);
    expect(() => assertValidRules({ target: 10.5, deuce: false, cap: 11 })).toThrow(RangeError);
    expect(() => assertValidRules({ target: 21, deuce: true, cap: 20 })).toThrow(RangeError);
  });
});

describe("matchWinner — test vector §1 (bwf21, best of 3)", () => {
  const bo3 = { games: 3 };

  it("[21–15, 18–21, 21–17] → A", () => {
    expect(
      matchWinner(
        [
          { a: 21, b: 15 },
          { a: 18, b: 21 },
          { a: 21, b: 17 },
        ],
        bwf21,
        bo3,
      ),
    ).toBe("A");
  });

  it("[21–15, 21–10] → A", () => {
    expect(
      matchWinner(
        [
          { a: 21, b: 15 },
          { a: 21, b: 10 },
        ],
        bwf21,
        bo3,
      ),
    ).toBe("A");
  });

  it("[21–15, 18–21] → null", () => {
    expect(
      matchWinner(
        [
          { a: 21, b: 15 },
          { a: 18, b: 21 },
        ],
        bwf21,
        bo3,
      ),
    ).toBeNull();
  });

  it("[21–15, 21–10, 5–3] → RangeError", () => {
    expect(() =>
      matchWinner(
        [
          { a: 21, b: 15 },
          { a: 21, b: 10 },
          { a: 5, b: 3 },
        ],
        bwf21,
        bo3,
      ),
    ).toThrow(RangeError);
  });
});

describe("matchWinner — tambahan", () => {
  it("1 game: pemenang game = pemenang match", () => {
    expect(matchWinner([{ a: 19, b: 21 }], bwf21, { games: 1 })).toBe("B");
    expect(matchWinner([{ a: 19, b: 20 }], bwf21, { games: 1 })).toBeNull();
    expect(matchWinner([], bwf21, { games: 1 })).toBeNull();
  });

  it("game yang belum selesai tidak dihitung", () => {
    expect(
      matchWinner(
        [
          { a: 21, b: 15 },
          { a: 10, b: 5 },
        ],
        bwf21,
        { games: 3 },
      ),
    ).toBeNull();
  });

  it("best of 5 butuh 3 game", () => {
    const games = [
      { a: 21, b: 1 },
      { a: 1, b: 21 },
      { a: 21, b: 1 },
      { a: 1, b: 21 },
    ];
    expect(matchWinner(games, bwf21, { games: 5 })).toBeNull();
    expect(matchWinner([...games, { a: 21, b: 1 }], bwf21, { games: 5 })).toBe("A");
  });

  it("jumlah game melebihi format atau format bukan ganjil → RangeError", () => {
    const games = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    expect(() => matchWinner(games, bwf21, { games: 1 })).toThrow(RangeError);
    expect(() => matchWinner([], bwf21, { games: 2 })).toThrow(RangeError);
    expect(() => matchWinner([], bwf21, { games: 0 })).toThrow(RangeError);
  });
});

describe("isFinalScore — skor akhir yang bisa dicapai", () => {
  it.each([
    [21, 19, true],
    [21, 0, true],
    [22, 20, true],
    [23, 21, true],
    [30, 29, true],
    [30, 28, true],
    [29, 30, true],
    [25, 10, false],
    [23, 20, false],
    [21, 20, false],
    [20, 20, false],
    [0, 0, false],
  ] as const)("bwf21 %i–%i → %s", (a, b, expected) => {
    expect(isFinalScore(a, b, bwf21)).toBe(expected);
  });

  it("tanpa deuce: pemenang tepat di target", () => {
    expect(isFinalScore(15, 14, poin15NoDeuce)).toBe(true);
    expect(isFinalScore(16, 3, poin15NoDeuce)).toBe(false);
  });
});

describe("checkGames — validasi rangkaian game", () => {
  const bo3 = { games: 3 };

  it("match berjalan: game terakhir boleh belum selesai", () => {
    expect(checkGames([{ a: 21, b: 15 }, { a: 7, b: 3 }], bwf21, bo3, { complete: false })).toBeNull();
    expect(checkGames([{ a: 0, b: 0 }], bwf21, { games: 1 }, { complete: false })).toBeNull();
  });

  it("mengembalikan pemenang bila match sudah ditentukan", () => {
    expect(checkGames([{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 17 }], bwf21, bo3, { complete: true })).toBe("A");
    expect(checkGames([{ a: 20, b: 22 }], bwf21, { games: 1 }, { complete: false })).toBe("B");
  });

  it("menolak skor mustahil, game tengah belum selesai, game kosong, atau match belum selesai saat complete", () => {
    expect(() => checkGames([{ a: 25, b: 10 }], bwf21, { games: 1 }, { complete: true })).toThrow(
      "Skor game 1 (25–10) tidak mungkin dengan aturan ini.",
    );
    expect(() => checkGames([{ a: 10, b: 5 }, { a: 21, b: 3 }], bwf21, bo3, { complete: false })).toThrow("Game 1 belum selesai.");
    expect(() => checkGames([], bwf21, bo3, { complete: false })).toThrow(RangeError);
    expect(() => checkGames([{ a: 21, b: 15 }], bwf21, bo3, { complete: true })).toThrow("Match belum selesai.");
    expect(() => checkGames([{ a: 21, b: 15 }, { a: 21, b: 1 }, { a: 0, b: 0 }], bwf21, bo3, { complete: false })).toThrow(RangeError);
  });
});
