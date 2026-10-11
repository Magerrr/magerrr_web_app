// Antrian giliran (PRD SC9, docs/ALGORITHMS.md §4.4): siapa berikutnya dan kira-kira kapan turun.
import type { MatchKind, MemberId } from "./types";

/** Mode rotasi: nomor giliran tiap posisi antrian (0 = masuk saat game berikutnya selesai). */
export function rotationTurns(queue: MemberId[], kind: MatchKind): number[] {
  const size = kind === "doubles" ? 2 : 1;
  return queue.map((_, i) => Math.floor(i / size));
}

/** Durasi khas satu match (menit): median durasi dalam [3, 90], dibulatkan; null bila tidak ada. */
export function matchMinutes(durations: number[]): number | null {
  const valid = durations.filter((d) => d >= 3 && d <= 90).sort((x, y) => x - y);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return Math.round(valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2);
}

/** Perkiraan menit sampai giliran 0..turns−1 masuk lapangan, dari menit berjalan tiap lapangan rotasi. */
export function turnEta(elapsed: number[], avg: number | null, turns: number): (number | null)[] {
  if (avg === null || elapsed.length === 0) return Array.from({ length: turns }, () => null);
  const ends = elapsed
    .flatMap((e) => Array.from({ length: turns }, (_, j) => Math.max(avg - e, 0) + j * avg))
    .sort((x, y) => x - y);
  return ends.slice(0, turns).map(Math.round);
}

/** Urutan istirahat kocok / pasangan tetap: paling sedikit main, paling lama istirahat, lalu urutan masukan. */
export function restingPriority<T extends { playedThisSession: number; roundsSinceLastPlayed: number }>(items: T[]): T[] {
  return [...items].sort(
    (x, y) => x.playedThisSession - y.playedThisSession || y.roundsSinceLastPlayed - x.roundsSinceLastPlayed,
  );
}
