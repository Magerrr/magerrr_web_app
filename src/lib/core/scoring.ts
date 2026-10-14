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

export type PointKind = "game" | "match";

/** Game yang sedang dimainkan: game terakhir, atau game baru 0–0 bila game terakhir sudah selesai. */
function openGame(games: GameScore[], rules: GameRules): { no: number; a: number; b: number; done: GameScore[] } {
  const last = games[games.length - 1];
  if (gameWinner(last.a, last.b, rules)) return { no: games.length + 1, a: 0, b: 0, done: games };
  return { no: games.length, a: last.a, b: last.b, done: games.slice(0, -1) };
}

function gamesWon(games: GameScore[], rules: GameRules): Record<Side, number> {
  const won = { A: 0, B: 0 };
  for (const { a, b } of games) {
    const side = gameWinner(a, b, rules);
    if (side) won[side]++;
  }
  return won;
}

/** Game point / match point per sisi pada game berjalan (PRD SC5, ALGORITHMS §1b). */
export function pointStatus(games: GameScore[], rules: GameRules, format: MatchFormat): Record<Side, PointKind | null> {
  if (matchWinner(games, rules, format)) return { A: null, B: null };
  const open = openGame(games, rules);
  const won = gamesWon(open.done, rules);
  const need = Math.ceil(format.games / 2);
  const status = (side: Side): PointKind | null => {
    const scored = side === "A" ? gameWinner(open.a + 1, open.b, rules) : gameWinner(open.a, open.b + 1, rules);
    if (!scored) return null;
    return won[side] + 1 === need ? "match" : "game";
  };
  return { A: status("A"), B: status("B") };
}

/**
 * Ganti sisi akibat perubahan `before → after` (PRD SC5, ALGORITHMS §1b): `game` saat game baru dimulai,
 * `interval` saat skor tertinggi di game penentu baru mencapai setengah target (bwf21: 11).
 */
export function sideChange(
  before: GameScore[],
  after: GameScore[],
  rules: GameRules,
  format: MatchFormat,
): "game" | "interval" | null {
  if (matchWinner(after, rules, format)) return null;
  const from = openGame(before, rules);
  const to = openGame(after, rules);
  if (to.no > from.no) return "game";
  if (to.no < from.no) return null;
  const need = Math.ceil(format.games / 2);
  const won = gamesWon(to.done, rules);
  if (won.A !== need - 1 || won.B !== need - 1) return null;
  const mid = Math.ceil(rules.target / 2);
  return Math.max(from.a, from.b) < mid && Math.max(to.a, to.b) >= mid ? "interval" : null;
}

/**
 * Sisi yang berada di ujung kiri lapangan (ALGORITHMS §1c), dengan asumsi A memulai game 1 di kiri.
 * Pemain pindah sisi tiap game baru dan sekali di game penentu saat skor tertinggi mencapai `ceil(target / 2)`.
 */
export function courtEnds(games: GameScore[], rules: GameRules, format: MatchFormat): Side {
  const last = games[games.length - 1];
  const game = matchWinner(games, rules, format) ? { no: games.length, a: last.a, b: last.b, done: games.slice(0, -1) } : openGame(games, rules);
  const need = Math.ceil(format.games / 2);
  const won = gamesWon(game.done, rules);
  const decider = won.A === need - 1 && won.B === need - 1;
  const swaps = game.no - 1 + (decider && Math.max(game.a, game.b) >= Math.ceil(rules.target / 2) ? 1 : 0);
  return swaps % 2 === 0 ? "A" : "B";
}

export type ServiceCourt = "right" | "left";

/**
 * Posisi kok saat servis (ALGORITHMS §1e): `server` = sisi yang memenangkan reli terakhir (yang servis).
 * Servis dari petak kanan bila skor pihak yang servis di game berjalan genap, kiri bila ganjil.
 * null bila pihak yang servis belum diketahui atau match sudah selesai.
 */
export function servePosition(games: GameScore[], server: Side | null, rules: GameRules, format: MatchFormat): { side: Side; court: ServiceCourt } | null {
  if (server === null || matchWinner(games, rules, format)) return null;
  const open = openGame(games, rules);
  const score = server === "A" ? open.a : open.b;
  return { side: server, court: score % 2 === 0 ? "right" : "left" };
}
