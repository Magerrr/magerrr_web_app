import { describe, expect, it } from "vitest";
import { assertValidPairs, autoPairs, fixedContext, pairKey, planFixedRound, type FixedPairState, type Pair } from "./fixed";
import type { MatchRecord } from "./types";

const state = (members: Pair, rating = 2, played = 0, since = 1): FixedPairState => ({ members, rating, playedThisSession: played, roundsSinceLastPlayed: since });
const none = () => 0;

function match(id: string, order: number, A: string[], B: string[], status: MatchRecord["status"] = "completed"): MatchRecord {
  return {
    id,
    sessionId: "s",
    seasonId: null,
    sessionDate: new Date(0),
    order,
    kind: "doubles",
    status,
    players: { A, B },
    games: [{ a: 21, b: 10 }],
    winner: status === "completed" ? "A" : null,
  };
}

describe("autoPairs", () => {
  it("terkuat dengan terlemah; id ↑ untuk seri; terurut dalam pasangan", () => {
    const players = [
      { id: "a", rating: 4 },
      { id: "b", rating: 3 },
      { id: "c", rating: 2 },
      { id: "d", rating: 1 },
    ];
    expect(autoPairs(players)).toEqual({ pairs: [["a", "d"], ["b", "c"]], unpaired: [] });
  });

  it("ganjil: pemain tengah tidak berpasangan", () => {
    const players = ["e", "a", "c", "b", "d"].map((id, i) => ({ id, rating: 5 - i }));
    // urut rating: e5 a4 c3 b2 d1 → tengah c
    expect(autoPairs(players)).toEqual({ pairs: [["d", "e"], ["a", "b"]], unpaired: ["c"] });
    expect(autoPairs([])).toEqual({ pairs: [], unpaired: [] });
  });

  it("validasi pasangan", () => {
    expect(() => assertValidPairs([["a", "b"], ["c", "d"]])).not.toThrow();
    expect(() => assertValidPairs([["a", "a"]])).toThrow("dua pemain berbeda");
    expect(() => assertValidPairs([["a", "b"], ["b", "c"]])).toThrow("dua pasangan");
  });
});

describe("fixedContext", () => {
  it("main, ronde sejak terakhir main, rating rata-rata, pertemuan (void diabaikan)", () => {
    const pairs: Pair[] = [["a", "b"], ["c", "d"], ["e", "f"]];
    const ratings = new Map([["a", 4], ["b", 2], ["c", 3], ["d", 3], ["e", 1], ["f", 1]]);
    const matches = [
      match("m1", 1, ["a", "b"], ["c", "d"]),
      match("m2", 2, ["c", "d"], ["f", "e"]),
      match("v", 3, ["a", "b"], ["e", "f"], "void"),
      match("r", 4, ["b", "a"], ["e", "f"], "running"),
    ];
    const { states, opponentCount } = fixedContext({ pairs, ratings, sessionMatches: matches });
    expect(states).toEqual([
      { members: ["a", "b"], rating: 3, playedThisSession: 1, roundsSinceLastPlayed: 1 },
      { members: ["c", "d"], rating: 3, playedThisSession: 2, roundsSinceLastPlayed: 0 },
      { members: ["e", "f"], rating: 1, playedThisSession: 1, roundsSinceLastPlayed: 0 },
    ]);
    expect(opponentCount(["a", "b"], ["c", "d"])).toBe(1);
    expect(opponentCount(["d", "c"], ["a", "b"])).toBe(1);
    expect(opponentCount(["a", "b"], ["e", "f"])).toBe(1); // match berjalan dihitung
    expect(opponentCount(["c", "d"], ["e", "f"])).toBe(1);
    expect(pairKey(["b", "a"])).toBe("a|b");
  });
});

describe("planFixedRound", () => {
  it("pasangan yang paling sedikit main didahulukan; sisanya istirahat", () => {
    const pairs = [state(["a", "b"], 2, 2), state(["c", "d"], 2, 0), state(["e", "f"], 2, 1), state(["g", "h"], 2, 0)];
    const plan = planFixedRound({ pairs, courts: 1, opponentCount: none }, 1);
    const playing = plan.courts.flatMap((t) => [t.A, t.B].map((m) => m.join("")));
    expect(new Set(playing)).toEqual(new Set(["cd", "gh"]));
    expect(plan.resting).toEqual([["e", "f"], ["a", "b"]]);
  });

  it("menghindari lawan yang sudah ditemui, lalu menyeimbangkan rating", () => {
    const pairs = [state(["a", "b"], 4), state(["c", "d"], 4), state(["e", "f"], 1), state(["g", "h"], 1)];
    // Tanpa riwayat: kuat vs kuat, lemah vs lemah.
    const balanced = planFixedRound({ pairs, courts: 2, opponentCount: none }, 7);
    const meets = (plan: ReturnType<typeof planFixedRound>) => new Set(plan.courts.map((t) => [pairKey(t.A as Pair), pairKey(t.B as Pair)].sort().join(" vs ")));
    expect(meets(balanced)).toEqual(new Set(["a|b vs c|d", "e|f vs g|h"]));
    // ab sudah 2× bertemu cd: 20 > ketimpangan 3×3 = 9 → pasangan silang.
    const met = (p: Pair, q: Pair) => ([pairKey(p), pairKey(q)].sort().join() === "a|b,c|d" ? 2 : 0);
    const crossed = planFixedRound({ pairs, courts: 2, opponentCount: met }, 7);
    expect(meets(crossed).has("a|b vs c|d")).toBe(false);
    expect(crossed.courts).toHaveLength(2);
  });

  it("kurang pasangan / tanpa lapangan", () => {
    expect(planFixedRound({ pairs: [state(["a", "b"])], courts: 2, opponentCount: none }, 1)).toEqual({ courts: [], resting: [["a", "b"]], hint: "kurang pemain" });
    expect(planFixedRound({ pairs: [state(["a", "b"]), state(["c", "d"])], courts: 0, opponentCount: none }, 1).hint).toBe("tidak ada lapangan");
  });

  it("deterministik per seed; lapangan banyak memakai jalur rakus tanpa pemain dobel", () => {
    const pairs = Array.from({ length: 14 }, (_, i) => state([`p${i}a`, `p${i}b`], (i % 4) + 1));
    const a = planFixedRound({ pairs, courts: 7, opponentCount: none }, 42);
    expect(a).toEqual(planFixedRound({ pairs, courts: 7, opponentCount: none }, 42));
    const ids = a.courts.flatMap((t) => [...t.A, ...t.B]);
    expect(ids).toHaveLength(28);
    expect(new Set(ids).size).toBe(28);
  });
});
