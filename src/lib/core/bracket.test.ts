import { describe, expect, it } from "vitest";
import { bracketSize, buildBracket, placements, readySlots, roundName, seedEntries, seedPositions, slotName, type Entry, type SlotMatch } from "./bracket";

// Peserta ganda e1…eN: seed i = pasangan [`a{i}`, `b{i}`].
const entries = (n: number): Entry[] => Array.from({ length: n }, (_, i) => ({ seed: i + 1, players: [`a${i + 1}`, `b${i + 1}`] }));
const team = (seed: number) => [`b${seed}`, `a${seed}`]; // urutan pemain di match tidak penting

function result(round: number, slot: number, top: number, bottom: number, a: number, b: number): SlotMatch {
  return { round, slot, matchId: `m${round}.${slot}`, status: "completed", players: { A: team(top), B: team(bottom) }, games: [{ a, b }], winner: a > b ? "A" : "B" };
}

describe("ukuran & posisi seed", () => {
  it.each([
    [2, 2],
    [3, 4],
    [5, 8],
    [8, 8],
    [9, 16],
    [32, 32],
  ])("%i peserta → bagan %i", (n, size) => {
    expect(bracketSize(n)).toBe(size);
  });

  it("jumlah peserta di luar 2…32 ditolak", () => {
    for (const n of [0, 1, 33, 2.5]) expect(() => bracketSize(n)).toThrow(RangeError);
  });

  it("posisi seed standar: seed 1 & 2 di paruh berbeda", () => {
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedPositions(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  it("nama babak", () => {
    expect([1, 2, 3].map((r) => roundName(r, 3))).toEqual(["Perempat final", "Semifinal", "Final"]);
    expect(roundName(1, 4)).toBe("Babak 16 besar");
    expect(roundName(1, 5)).toBe("Babak 32 besar");
    expect(slotName(2, 1, 3)).toBe("Semifinal 2");
    expect(slotName(3, 0, 3)).toBe("Final");
  });
});

describe("buildBracket", () => {
  it("6 peserta: bye untuk seed 1 & 2, sisanya siap main", () => {
    const b = buildBracket(entries(6), []);
    expect(b.size).toBe(8);
    expect(b.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(b.rounds[0].map((s) => [s.a, s.b, s.state, s.winner])).toEqual([
      [1, null, "bye", 1],
      [4, 5, "ready", null],
      [2, null, "bye", 2],
      [3, 6, "ready", null],
    ]);
    expect(b.rounds[1].map((s) => [s.a, s.b, s.state])).toEqual([
      [1, null, "waiting"],
      [2, null, "waiting"],
    ]);
    expect(readySlots(b).map((s) => `${s.round}:${s.slot}`)).toEqual(["1:1", "1:3"]);
    expect(b.champion).toBeNull();
  });

  it("pemenang maju ke babak berikutnya; match berjalan → running", () => {
    const running: SlotMatch = { ...result(1, 3, 3, 6, 5, 3), status: "running", winner: null };
    const b = buildBracket(entries(6), [result(1, 1, 4, 5, 15, 21), running]);
    expect(b.rounds[0][1]).toMatchObject({ state: "done", winner: 5 });
    expect(b.rounds[0][3]).toMatchObject({ state: "running", winner: null });
    expect(b.rounds[1][0]).toMatchObject({ a: 1, b: 5, state: "ready" });
    expect(b.rounds[1][1]).toMatchObject({ a: 2, b: null, state: "waiting" });
  });

  it("tim match tidak cocok dengan peserta slot → konflik, tidak ada yang maju", () => {
    // Semifinal sudah dimainkan 1 vs 4, lalu hasil 4 vs 5 diedit sehingga 5 yang menang.
    const b = buildBracket(entries(6), [result(1, 1, 4, 5, 15, 21), result(2, 0, 1, 4, 21, 10)]);
    expect(b.rounds[1][0]).toMatchObject({ a: 1, b: 5, state: "conflict", winner: null });
    expect(b.rounds[2][0]).toMatchObject({ a: null, state: "waiting" });
    // Match di slot yang pesertanya belum lengkap juga konflik; urutan pemain di sisi tidak penting.
    expect(buildBracket(entries(6), [result(2, 1, 2, 3, 21, 1)]).rounds[1][1].state).toBe("conflict");
    expect(buildBracket(entries(2), [{ ...result(1, 0, 1, 2, 21, 1), players: { A: ["a1", "b1"], B: ["a2", "b2"] } }]).champion).toBe(1);
  });

  it("4 peserta selesai: juara, finalis, dua semifinalis", () => {
    // Posisi [1,4,2,3]: SF1 1 vs 4, SF2 2 vs 3.
    const matches = [result(1, 0, 1, 4, 21, 18), result(1, 1, 2, 3, 19, 21), result(2, 0, 1, 3, 17, 21)];
    const b = buildBracket(entries(4), matches);
    expect(b.champion).toBe(3);
    expect(readySlots(b)).toEqual([]);
    expect(placements(b, 4)).toEqual([
      { seed: 3, place: 1, won: 2, lost: 0 },
      { seed: 1, place: 2, won: 1, lost: 1 },
      { seed: 2, place: 3, won: 0, lost: 1 },
      { seed: 4, place: 3, won: 0, lost: 1 },
    ]);
  });

  it("peringkat di tengah turnamen: yang masih bertanding tanpa peringkat", () => {
    const b = buildBracket(entries(6), [result(1, 1, 4, 5, 15, 21)]);
    expect(placements(b, 6)).toEqual([
      { seed: 4, place: 5, won: 0, lost: 1 },
      { seed: 1, place: null, won: 0, lost: 0 },
      { seed: 2, place: null, won: 0, lost: 0 },
      { seed: 3, place: null, won: 0, lost: 0 },
      { seed: 5, place: null, won: 1, lost: 0 },
      { seed: 6, place: null, won: 0, lost: 0 },
    ]);
  });

  it("seed tidak sah ditolak", () => {
    expect(() => buildBracket([{ seed: 1, players: ["x"] }, { seed: 1, players: ["y"] }], [])).toThrow(RangeError);
    expect(() => buildBracket([{ seed: 1, players: ["x"] }, { seed: 3, players: ["y"] }], [])).toThrow(RangeError);
  });
});

describe("seedEntries", () => {
  const teams = [
    { players: ["p1"], rating: 2.5 },
    { players: ["p2"], rating: 4 },
    { players: ["p3"], rating: 2.5 },
    { players: ["p4"], rating: 1 },
    { players: ["p5"], rating: 2.5 },
  ];

  it("rating ↓; seri diacak ber-seed dan bisa direproduksi", () => {
    const seeded = seedEntries(teams, "rating", 42);
    expect(seeded.map((e) => e.seed)).toEqual([1, 2, 3, 4, 5]);
    expect(seeded[0].players).toEqual(["p2"]);
    expect(seeded[4].players).toEqual(["p4"]);
    expect(seeded.slice(1, 4).map((e) => e.players[0]).sort()).toEqual(["p1", "p3", "p5"]);
    expect(seedEntries(teams, "rating", 42)).toEqual(seeded);
  });

  it("acak penuh: semua peserta tetap ada, urutan bergantung seed", () => {
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => seedEntries(teams, "random", s).map((e) => e.players[0]).join()));
    expect(orders.size).toBeGreaterThan(1);
    for (const order of orders) expect(order.split(",").sort()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });
});
