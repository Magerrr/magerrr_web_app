// Aturan game & match badminton (docs/ALGORITHMS.md §0–§1). PRD: SC3, SC4, SC6.
import type { GameScore, Side } from "./types";

export interface GameRules {
  /** 21 | 15 | 11 | kustom (>= 5) */
  target: number;
  /** true: harus unggul 2 setelah mencapai target */
  deuce: boolean;
  /** batas maksimum, hanya dipakai jika deuce = true */
  cap: number;
}

/** Jumlah game maksimum, ganjil: 1 | 3 | 5 */
export interface MatchFormat {
  games: number;
}

export const PRESETS = {
  bwf21: { target: 21, deuce: true, cap: 30 },
  poin15: { target: 15, deuce: true, cap: 21 },
  poin11: { target: 11, deuce: true, cap: 15 },
} as const satisfies Record<string, GameRules>;

export function assertValidRules(rules: GameRules): void {
  if (!Number.isInteger(rules.target) || rules.target < 5) {
    throw new RangeError(`target harus integer >= 5, bukan ${rules.target}`);
  }
  if (rules.deuce && (!Number.isInteger(rules.cap) || rules.cap < rules.target)) {
    throw new RangeError(`cap harus integer >= target (${rules.target}), bukan ${rules.cap}`);
  }
}

function assertScore(x: number): void {
  if (!Number.isInteger(x) || x < 0) throw new RangeError(`skor harus integer >= 0, bukan ${x}`);
}

function wins(x: number, y: number, rules: GameRules): boolean {
  if (!rules.deuce) return x >= rules.target;
  return x >= rules.cap || (x >= rules.target && x - y >= 2);
}

/** Pemenang satu game, atau null bila game belum selesai. */
export function gameWinner(a: number, b: number, rules: GameRules): Side | null {
  assertScore(a);
  assertScore(b);
  assertValidRules(rules);
  const aWins = wins(a, b, rules);
  const bWins = wins(b, a, rules);
  if (aWins && bWins) throw new RangeError(`skor ${a}–${b} tidak mungkin: kedua sisi memenuhi syarat menang`);
  return aWins ? "A" : bWins ? "B" : null;
}

export function assertValidFormat(format: MatchFormat): void {
  if (![1, 3, 5].includes(format.games)) {
    throw new RangeError(`jumlah game harus 1, 3, atau 5, bukan ${format.games}`);
  }
}

/** Pemenang match (first to ceil(games/2)), atau null bila belum ada. */
export function matchWinner(games: GameScore[], rules: GameRules, format: MatchFormat): Side | null {
  assertValidFormat(format);
  if (games.length > format.games) {
    throw new RangeError(`${games.length} game melebihi format ${format.games} game`);
  }
  const need = Math.ceil(format.games / 2);
  const won = { A: 0, B: 0 };
  let winner: Side | null = null;
  games.forEach(({ a, b }, i) => {
    if (winner) throw new RangeError(`game ${i + 1} ditambahkan setelah match dimenangkan ${winner}`);
    const side = gameWinner(a, b, rules);
    if (side && ++won[side] === need) winner = side;
  });
  return winner;
}

/**
 * Skor akhir yang bisa dicapai dengan rally point: game sudah selesai DAN satu poin sebelumnya
 * belum selesai. Contoh bwf21: 22–20 dan 30–29 sah; 25–10 tidak (game sudah berakhir di 21–10).
 */
export function isFinalScore(a: number, b: number, rules: GameRules): boolean {
  const winner = gameWinner(a, b, rules);
  if (!winner) return false;
  return winner === "A" ? gameWinner(a - 1, b, rules) === null : gameWinner(a, b - 1, rules) === null;
}

/**
 * Validasi rangkaian game sebuah match. Game sebelum yang terakhir wajib selesai; tiap game selesai
 * wajib skor akhir yang sah. `complete` = match harus sudah punya pemenang. Mengembalikan pemenang.
 */
export function checkGames(
  games: GameScore[],
  rules: GameRules,
  format: MatchFormat,
  { complete }: { complete: boolean },
): Side | null {
  assertValidFormat(format);
  if (games.length === 0) throw new RangeError("Belum ada game.");
  games.forEach(({ a, b }, i) => {
    const winner = gameWinner(a, b, rules);
    if (winner && !isFinalScore(a, b, rules)) {
      throw new RangeError(`Skor game ${i + 1} (${a}–${b}) tidak mungkin dengan aturan ini.`);
    }
    if (!winner && i < games.length - 1) throw new RangeError(`Game ${i + 1} belum selesai.`);
  });
  const winner = matchWinner(games, rules, format);
  if (complete && !winner) throw new RangeError("Match belum selesai.");
  return winner;
}
