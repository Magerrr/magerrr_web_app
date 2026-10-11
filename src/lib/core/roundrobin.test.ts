import { describe, expect, it } from "vitest";
import type { Entry } from "./bracket";
import { buildPool, fixtureCount, rankPool, roundCount, roundRobinRounds, type PoolMatch } from "./roundrobin";

// Peserta tunggal: seed i = pemain `p{i}`.
const entries = (n: number): Entry[] => Array.from({ length: n }, (_, i) => ({ seed: i + 1, players: [`p${i + 1}`] }));

/** Hasil match a vs b (a < b) dengan skor gim dari sisi a. */
function played(a: number, b: number, ...games: [number, number][]): PoolMatch {
  const scores = games.map(([x, y]) => ({ a: x, b: y }));
  const wonA = scores.filter((g) => g.a > g.b).length;
  return { a, b, matchId: `m${a}-${b}`, status: "completed", players: { A: [`p${a}`], B: [`p${b}`] }, games: scores, winner: wonA * 2 > scores.length ? "A" : "B" };
}

describe("jadwal round robin (metode lingkaran)", () => {
  it("4 peserta: 3 ronde, seed 1 tetap", () => {
    expect(roundRobinRounds([1, 2, 3, 4])).toEqual([
      [
        [1, 4],
        [2, 3],
      ],
      [
        [1, 3],
        [2, 4],
      ],
      [
        [1, 2],
        [3, 4],
      ],
    ]);
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 12])("%i peserta: tiap pasangan tepat sekali, tiap ronde tiap peserta paling banyak sekali", (n) => {
    const seeds = Array.from({ length: n }, (_, i) => i + 1);
    const rounds = roundRobinRounds(seeds);
    expect(rounds).toHaveLength(roundCount(n));
    const pairs = rounds.flat().map(([a, b]) => `${a}-${b}`);
    expect(pairs).toHaveLength(fixtureCount(n));
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const round of rounds) {
      const seen = round.flat();
      expect(new Set(seen).size).toBe(seen.length);
      expect(round.every(([a, b]) => a < b)).toBe(true);
    }
  });

  it("ganjil: tiap peserta istirahat tepat sekali", () => {
    const rounds = roundRobinRounds([1, 2, 3, 4, 5]);
    const rests = rounds.map((round) => [1, 2, 3, 4, 5].find((s) => !round.flat().includes(s)));
    expect(rests.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("seed grup tidak harus berurutan", () => {
    expect(roundRobinRounds([2, 7, 10]).flat()).toEqual([
      [7, 10],
      [2, 10],
      [2, 7],
    ]);
  });
});

describe("buildPool", () => {
  it("keadaan match: siap, berjalan, selesai, konflik", () => {
    const running: PoolMatch = { ...played(1, 2, [5, 3]), status: "running", winner: null };
    const wrong: PoolMatch = { ...played(1, 3, [21, 3]), players: { A: ["p1"], B: ["p4"] } };
    const pool = buildPool([3, 1, 2], entries(4), [running, wrong, played(2, 3, [21, 19])]);
    expect(pool.seeds).toEqual([1, 2, 3]);
    expect(pool.fixtures.map((f) => [f.a, f.b, f.state, f.winner])).toEqual([
      [2, 3, "done", 2],
      [1, 3, "conflict", null],
      [1, 2, "running", null],
    ]);
    expect(pool.complete).toBe(false);
  });

  it("selesai: klasemen final, statistik gim & poin dari sisi peserta", () => {
    const pool = buildPool([1, 2, 3], entries(3), [played(1, 2, [21, 10]), played(1, 3, [15, 21], [21, 18], [21, 19]), played(2, 3, [21, 23])]);
    expect(pool.complete).toBe(true);
    expect(pool.table).toEqual([
      { seed: 1, place: 1, played: 2, won: 2, lost: 0, gamesWon: 3, gamesLost: 1, pointsFor: 78, pointsAgainst: 68 },
      { seed: 3, place: 2, played: 2, won: 1, lost: 1, gamesWon: 2, gamesLost: 2, pointsFor: 81, pointsAgainst: 78 },
      { seed: 2, place: 3, played: 2, won: 0, lost: 2, gamesWon: 0, gamesLost: 2, pointsFor: 31, pointsAgainst: 44 },
    ]);
  });
});

describe("peringkat (aturan BWF)", () => {
  const rank = (n: number, matches: PoolMatch[]) => buildPool(Array.from({ length: n }, (_, i) => i + 1), entries(n), matches).table.map((r) => r.seed);

  it("dua peserta seri menang → adu langsung, walau selisih gim/poin lebih buruk", () => {
    // 2 & 3 sama-sama 2 menang. 3 mengalahkan 2, meski 2 menang telak di match lain.
    const matches = [played(1, 2, [1, 21], [1, 21]), played(1, 3, [19, 21]), played(1, 4, [21, 5]), played(2, 3, [20, 22]), played(2, 4, [21, 1], [21, 1]), played(3, 4, [10, 21])];
    expect(rank(4, matches)).toEqual([3, 2, 1, 4]);
  });

  it("tiga seri (saling mengalahkan) → selisih gim", () => {
    // 1>2 (2–0), 2>3 (2–1), 3>1 (2–1): selisih gim 1: +1, 2: −1, 3: 0.
    const matches = [played(1, 2, [21, 10], [21, 10]), played(2, 3, [21, 10], [10, 21], [21, 10]), played(1, 3, [21, 10], [10, 21], [10, 21])];
    expect(rank(3, matches)).toEqual([1, 3, 2]);
  });

  it("tiga seri, gim sama → selisih poin; tersisa dua seri → adu langsung", () => {
    // Siklus 2>1, 3>2, 1>3, satu gim per match → selisih gim semua 0.
    const cycle = (last: [number, number]) => [played(1, 2, [10, 21]), played(2, 3, [15, 21]), played(1, 3, last)];
    // 1 vs 3 21–10: poin 1 0, 2 +5, 3 −5.
    expect(rank(3, cycle([21, 10]))).toEqual([2, 1, 3]);
    // 1 vs 3 30–29: poin 1 −10, 2 +5, 3 +5 → 2 & 3 seri, 3 mengalahkan 2.
    expect(rank(3, cycle([30, 29]))).toEqual([3, 2, 1]);
  });

  it("seri penuh / belum ada match → urut seed", () => {
    expect(rank(4, [])).toEqual([1, 2, 3, 4]);
    const cycle = [played(1, 2, [21, 10]), played(2, 3, [21, 10]), played(1, 3, [10, 21])];
    expect(rank(3, cycle)).toEqual([1, 2, 3]);
  });

  it("klasemen sementara hanya dari match selesai", () => {
    const rows = rankPool([1, 2, 3], [
      { round: 1, a: 2, b: 3, state: "done", winner: 3, match: played(2, 3, [10, 21]) },
      { round: 2, a: 1, b: 3, state: "running", winner: null, match: { ...played(1, 3, [11, 2]), status: "running", winner: null } },
      { round: 3, a: 1, b: 2, state: "ready", winner: null, match: null },
    ]);
    expect(rows.map((r) => [r.seed, r.place, r.played, r.won])).toEqual([
      [3, 1, 1, 1],
      [1, 2, 0, 0],
      [2, 3, 1, 0],
    ]);
  });
});
