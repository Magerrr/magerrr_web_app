// Transisi skor live (PRD SC2–SC3): tap sisi yang mencetak poin, game selesai otomatis.
import { gameWinner, matchWinner, type GameRules, type MatchFormat } from "./rules";
import type { GameScore, Side } from "./types";

/** +1 untuk `side` di game berjalan. Game yang selesai membuka game baru 0–0 bila match belum ditentukan. */
export function addPoint(games: GameScore[], side: Side, rules: GameRules, format: MatchFormat): GameScore[] {
  if (matchWinner(games, rules, format)) return games;
  const finished = games[games.length - 1];
  const open = gameWinner(finished.a, finished.b, rules) ? [...games, { a: 0, b: 0 }] : games;
  const last = open[open.length - 1];
  const scored = side === "A" ? { a: last.a + 1, b: last.b } : { a: last.a, b: last.b + 1 };
  const next = [...open.slice(0, -1), scored];
  if (gameWinner(scored.a, scored.b, rules) && !matchWinner(next, rules, format)) next.push({ a: 0, b: 0 });
  return next;
}

/**
 * −1 untuk `side`. Pada game baru 0–0, −1 untuk pemenang game sebelumnya membatalkan poin penutupnya
 * (kembali ke game itu); sisi lain diabaikan agar skor akhir game sebelumnya tidak berubah diam-diam.
 */
export function removePoint(games: GameScore[], side: Side, rules: GameRules): GameScore[] {
  let next = games;
  const last = games[games.length - 1];
  if (games.length > 1 && last.a === 0 && last.b === 0) {
    const prev = games[games.length - 2];
    if (gameWinner(prev.a, prev.b, rules) !== side) return games;
    next = games.slice(0, -1);
  }
  const current = next[next.length - 1];
  const value = side === "A" ? current.a : current.b;
  if (value === 0) return games;
  const reduced = side === "A" ? { a: current.a - 1, b: current.b } : { a: current.a, b: current.b - 1 };
  return [...next.slice(0, -1), reduced];
}

export function currentGame(games: GameScore[]): { no: number; a: number; b: number } {
  const last = games[games.length - 1];
  return { no: games.length, a: last.a, b: last.b };
}
