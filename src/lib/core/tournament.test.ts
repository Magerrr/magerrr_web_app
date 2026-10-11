import { describe, expect, it } from "vitest";
import type { Entry } from "./bracket";
import {
  buildTournament,
  formatProblem,
  knockoutSize,
  knockoutSources,
  linkLabel,
  schedule,
  snakeGroups,
  type LinkedMatch,
  type TournamentSpec,
} from "./tournament";

// Peserta tunggal: seed i = pemain `p{i}`.
const entries = (n: number, groups?: number[]): Entry[] =>
  Array.from({ length: n }, (_, i) => ({ seed: i + 1, players: [`p${i + 1}`], ...(groups ? { group: groups[i] } : {}) }));

/** Match round robin / grup a vs b (a < b), satu gim, dimenangkan `winner`. */
const pool = (a: number, b: number, winner: number): LinkedMatch => ({
  link: { stage: "pool", a, b },
  matchId: `p${a}-${b}`,
  status: "completed",
  players: { A: [`p${a}`], B: [`p${b}`] },
  games: [winner === a ? { a: 21, b: 10 } : { a: 10, b: 21 }],
  winner: winner === a ? "A" : "B",
});

/** Match bagan: peserta atas `top` (sisi A) vs bawah `bottom`. */
const knock = (round: number, slot: number, top: number, bottom: number, winner: number): LinkedMatch => ({
  link: { stage: "knockout", round, slot },
  matchId: `k${round}.${slot}`,
  status: "completed",
  players: { A: [`p${top}`], B: [`p${bottom}`] },
  games: [winner === top ? { a: 21, b: 15 } : { a: 15, b: 21 }],
  winner: winner === top ? "A" : "B",
});

describe("formatProblem", () => {
  it("sistem gugur 2–32", () => {
    expect(formatProblem("knockout", 1, null)).toBe("Butuh minimal 2 peserta.");
    expect(formatProblem("knockout", 2, null)).toBeNull();
    expect(formatProblem("knockout", 32, null)).toBeNull();
    expect(formatProblem("knockout", 33, null)).toBe("Maksimal 32 peserta.");
  });

  it("round robin 3–12", () => {
    expect(formatProblem("round_robin", 2, null)).toBe("Round robin butuh minimal 3 peserta.");
    expect(formatProblem("round_robin", 3, null)).toBeNull();
    expect(formatProblem("round_robin", 12, null)).toBeNull();
    expect(formatProblem("round_robin", 13, null)).toBe("Round robin maksimal 12 peserta (66 match). Pakai grup + gugur.");
  });

  it("grup + gugur: minimal G × (lolos + 1), maksimal 8 per grup", () => {
    expect(formatProblem("groups_knockout", 8, null)).toBe("Pilih jumlah grup.");
    expect(formatProblem("groups_knockout", 4, { count: 2, advance: 1 })).toBeNull();
    expect(formatProblem("groups_knockout", 5, { count: 2, advance: 2 })).toBe("2 grup dengan 2 lolos per grup butuh minimal 6 peserta.");
    expect(formatProblem("groups_knockout", 6, { count: 2, advance: 2 })).toBeNull();
    expect(formatProblem("groups_knockout", 16, { count: 2, advance: 2 })).toBeNull();
    expect(formatProblem("groups_knockout", 17, { count: 2, advance: 2 })).toBe("2 grup maksimal 16 peserta (8 per grup). Tambah jumlah grup.");
    expect(formatProblem("groups_knockout", 23, { count: 8, advance: 2 })).toBe("8 grup dengan 2 lolos per grup butuh minimal 24 peserta.");
    expect(formatProblem("groups_knockout", 32, { count: 8, advance: 2 })).toBeNull();
  });
});

describe("pembagian grup & bagan grup + gugur", () => {
  it("ular: unggulan tersebar, ukuran grup selisih paling banyak 1", () => {
    expect(snakeGroups(10, 4)).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 0, 1]);
    expect(snakeGroups(8, 2)).toEqual([0, 1, 1, 0, 0, 1, 1, 0]);
  });

  it("asal posisi bagan: juara grup tidak bertemu runner-up grup yang sama sebelum final", () => {
    const label = (s: { group: number; place: number }) => `${"ABCDEFGH"[s.group]}${s.place}`;
    expect(knockoutSources({ count: 2, advance: 1 }).map(label)).toEqual(["A1", "B1"]);
    expect(knockoutSources({ count: 4, advance: 1 }).map(label)).toEqual(["A1", "D1", "B1", "C1"]);
    expect(knockoutSources({ count: 2, advance: 2 }).map(label)).toEqual(["A1", "B2", "B1", "A2"]);
    expect(knockoutSources({ count: 4, advance: 2 }).map(label)).toEqual(["A1", "B2", "D1", "C2", "B1", "A2", "C1", "D2"]);
    for (const count of [2, 4, 8] as const) {
      const sources = knockoutSources({ count, advance: 2 });
      const half = (i: number) => (i < count ? 0 : 1);
      for (let g = 0; g < count; g++) {
        const [w, r] = [1, 2].map((place) => sources.findIndex((s) => s.group === g && s.place === place));
        expect(half(w)).not.toBe(half(r));
      }
    }
  });

  it("ukuran bagan & label match", () => {
    const groups: TournamentSpec = { format: "groups_knockout", entries: entries(8, snakeGroups(8, 2)), groups: { count: 2, advance: 2 } };
    expect(knockoutSize(groups, 8)).toBe(4);
    expect(knockoutSize({ format: "knockout", groups: null }, 6)).toBe(8);
    expect(knockoutSize({ format: "round_robin", groups: null }, 6)).toBe(0);
    expect(linkLabel(groups, { stage: "pool", a: 2, b: 3 })).toBe("Grup B");
    expect(linkLabel(groups, { stage: "knockout", round: 1, slot: 1 })).toBe("Semifinal 2");
    expect(linkLabel(groups, { stage: "knockout", round: 2, slot: 0 })).toBe("Final");
    expect(linkLabel({ format: "knockout", entries: entries(6), groups: null }, { stage: "knockout", round: 1, slot: 1 })).toBe("Perempat final 2");
    expect(linkLabel({ format: "round_robin", entries: entries(4), groups: null }, { stage: "pool", a: 1, b: 2 })).toBe("Round robin");
  });
});

describe("buildTournament — grup + gugur (8 peserta, 2 grup, 2 lolos)", () => {
  // Grup A: seed 1, 4, 5, 8. Grup B: 2, 3, 6, 7. Semifinal: A1 vs B2, B1 vs A2.
  const spec: TournamentSpec = { format: "groups_knockout", entries: entries(8, snakeGroups(8, 2)), groups: { count: 2, advance: 2 } };
  const groupA = [pool(1, 4, 1), pool(1, 5, 1), pool(1, 8, 1), pool(4, 5, 5), pool(5, 8, 5), pool(4, 8, 4)]; // 1, 5, 4, 8
  const groupB = [pool(2, 3, 2), pool(2, 6, 2), pool(2, 7, 2), pool(3, 6, 3), pool(3, 7, 3), pool(6, 7, 6)]; // 2, 3, 6, 7

  it("jadwal: ronde per ronde, grup A lalu B, kemudian bagan", () => {
    const state = buildTournament(spec, []);
    expect(state.pools.map((p) => p.seeds)).toEqual([
      [1, 4, 5, 8],
      [2, 3, 6, 7],
    ]);
    expect(schedule(state, spec.format).map((i) => i.key)).toEqual([
      "p:1:8",
      "p:4:5",
      "p:2:7",
      "p:3:6",
      "p:1:5",
      "p:4:8",
      "p:2:6",
      "p:3:7",
      "p:1:4",
      "p:5:8",
      "p:2:3",
      "p:6:7",
      "k:1:0",
      "k:1:1",
      "k:2:0",
    ]);
    expect(schedule(state, spec.format)[2]).toMatchObject({ no: 3, group: 1, round: 1, state: "ready" });
    expect(schedule(state, spec.format).at(-1)).toMatchObject({ no: null, group: null, round: 2, state: "waiting" });
    expect(state.bracket!.rounds[0].map((s) => [s.a, s.b, s.state])).toEqual([
      [null, null, "waiting"],
      [null, null, "waiting"],
    ]);
    expect(state.standings.every((s) => s.place === null)).toBe(true);
  });

  it("posisi bagan terisi per grup setelah semua match grup itu selesai", () => {
    const partial = buildTournament(spec, [...groupA, ...groupB.slice(0, 5)]);
    expect(partial.pools.map((p) => p.complete)).toEqual([true, false]);
    expect(partial.bracket!.rounds[0].map((s) => [s.a, s.b, s.state])).toEqual([
      [1, null, "waiting"],
      [null, 5, "waiting"],
    ]);
    const done = buildTournament(spec, [...groupA, ...groupB]);
    expect(done.bracket!.rounds[0].map((s) => [s.a, s.b, s.state])).toEqual([
      [1, 3, "ready"],
      [2, 5, "ready"],
    ]);
    // Yang gugur di grup sudah punya peringkat; yang lolos masih bertanding.
    expect(done.standings.map((s) => [s.seed, s.place, s.groupPlace])).toEqual([
      [4, 5, 3],
      [6, 5, 3],
      [7, 7, 4],
      [8, 7, 4],
      [1, null, null],
      [2, null, null],
      [3, null, null],
      [5, null, null],
    ]);
  });

  it("selesai: juara, peringkat akhir, menang–kalah gabungan grup + bagan", () => {
    const state = buildTournament(spec, [...groupA, ...groupB, knock(1, 0, 1, 3, 3), knock(1, 1, 2, 5, 2), knock(2, 0, 3, 2, 2)]);
    expect(state.champion).toBe(2);
    expect(state.standings).toEqual([
      { seed: 2, place: 1, won: 5, lost: 0, groupPlace: null },
      { seed: 3, place: 2, won: 3, lost: 2, groupPlace: null },
      { seed: 1, place: 3, won: 3, lost: 1, groupPlace: null },
      { seed: 5, place: 3, won: 2, lost: 2, groupPlace: null },
      { seed: 4, place: 5, won: 1, lost: 2, groupPlace: 3 },
      { seed: 6, place: 5, won: 1, lost: 2, groupPlace: 3 },
      { seed: 7, place: 7, won: 0, lost: 3, groupPlace: 4 },
      { seed: 8, place: 7, won: 0, lost: 3, groupPlace: 4 },
    ]);
  });

  it("hasil grup diedit sehingga yang lolos berubah → match bagan jadi konflik", () => {
    const edited = groupA.map((m) => (m.matchId === "p4-5" ? pool(4, 5, 4) : m)); // A: 1, 4, 5, 8
    const state = buildTournament(spec, [...edited, ...groupB, knock(1, 1, 2, 5, 2)]);
    expect(state.bracket!.rounds[0][1]).toMatchObject({ a: 2, b: 4, state: "conflict", winner: null });
  });

  it("grup peserta wajib sah", () => {
    expect(() => buildTournament({ ...spec, entries: entries(8) }, [])).toThrow(RangeError);
    expect(() => buildTournament({ ...spec, groups: null }, [])).toThrow(RangeError);
  });
});

describe("buildTournament — round robin & sistem gugur", () => {
  it("round robin: juara baru ada setelah semua match selesai", () => {
    const spec: TournamentSpec = { format: "round_robin", entries: entries(4), groups: null };
    const all = [pool(1, 2, 2), pool(1, 3, 1), pool(1, 4, 1), pool(2, 3, 2), pool(2, 4, 4), pool(3, 4, 3)];
    const partial = buildTournament(spec, all.slice(0, 5));
    expect(partial.champion).toBeNull();
    expect(partial.bracket).toBeNull();
    // Klasemen sementara: 1 & 2 menang 2 (2 mengalahkan 1), 4 menang 1, 3 belum menang.
    expect(partial.standings.map((s) => [s.seed, s.place])).toEqual([
      [2, null],
      [1, null],
      [4, null],
      [3, null],
    ]);
    const done = buildTournament(spec, all);
    expect(done.champion).toBe(2); // 1 & 2 menang 2, 2 mengalahkan 1; 3 & 4 menang 1, 3 mengalahkan 4
    expect(done.standings.map((s) => [s.seed, s.place, s.won, s.lost])).toEqual([
      [2, 1, 2, 1],
      [1, 2, 2, 1],
      [3, 3, 1, 2],
      [4, 4, 1, 2],
    ]);
    expect(schedule(done, spec.format).map((i) => [i.key, i.round, i.group, i.state])).toEqual([
      ["p:1:4", 1, null, "done"],
      ["p:2:3", 1, null, "done"],
      ["p:1:3", 2, null, "done"],
      ["p:2:4", 2, null, "done"],
      ["p:1:2", 3, null, "done"],
      ["p:3:4", 3, null, "done"],
    ]);
  });

  it("sistem gugur: sama dengan buildBracket, bye tidak masuk jadwal", () => {
    const state = buildTournament({ format: "knockout", entries: entries(3), groups: null }, [knock(1, 1, 2, 3, 3), knock(2, 0, 1, 3, 1)]);
    expect(state.pools).toEqual([]);
    expect(state.champion).toBe(1);
    expect(state.standings).toEqual([
      { seed: 1, place: 1, won: 1, lost: 0, groupPlace: null },
      { seed: 3, place: 2, won: 1, lost: 1, groupPlace: null },
      { seed: 2, place: 3, won: 0, lost: 1, groupPlace: null },
    ]);
    expect(schedule(state, "knockout").map((i) => i.key)).toEqual(["k:1:1", "k:2:0"]);
  });
});
