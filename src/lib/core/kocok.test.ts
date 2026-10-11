import { describe, expect, it } from "vitest";
import {
  EMPTY_HISTORY,
  mulberry32,
  planRound,
  kocokContext,
  playerRating,
  type KocokPlayer,
  type PairHistory,
  type RoundPlan,
} from "./kocok";
import type { MatchRecord } from "./types";

const player = (id: string, over: Partial<KocokPlayer> = {}): KocokPlayer => ({
  id,
  rating: 2.5,
  playedThisSession: 0,
  roundsSinceLastPlayed: 0,
  ...over,
});
const players = (n: number) => Array.from({ length: n }, (_, i) => player(`p${i + 1}`));
const playing = (plan: RoundPlan) => plan.courts.flatMap((c) => [...c.A, ...c.B]);
const together = (plan: RoundPlan, a: string, b: string) =>
  plan.courts.some((c) => [c.A, c.B].some((t) => t.includes(a) && t.includes(b)));

function historyFrom(counts: Record<string, number>): PairHistory {
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  return { ...EMPTY_HISTORY, partnerCountSession: (a, b) => counts[key(a, b)] ?? 0 };
}

describe("mulberry32", () => {
  it("deterministik dan dalam [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(43)()).not.toBe(xs[0]);
  });
});

describe("planRound — test vector §4.2", () => {
  it("8 pemain, 2 lapangan → 8 main, 0 istirahat, tiap pemain tepat sekali", () => {
    const plan = planRound({ players: players(8), courts: 2, format: "doubles" }, 1);
    expect(plan.courts).toHaveLength(2);
    expect(plan.resting).toEqual([]);
    expect(new Set(playing(plan)).size).toBe(8);
    expect(plan.courts.every((c) => c.A.length === 2 && c.B.length === 2)).toBe(true);
  });

  it("9 pemain, 2 lapangan → yang playedThisSession terbesar istirahat", () => {
    const ps = players(9).map((p) => ({ ...p, playedThisSession: p.id === "p4" ? 3 : 2 }));
    for (let seed = 0; seed < 20; seed++) {
      const plan = planRound({ players: ps, courts: 2, format: "doubles" }, seed);
      expect(playing(plan)).toHaveLength(8);
      expect(plan.resting).toEqual(["p4"]);
    }
  });

  it("9 pemain, 2 lapangan → bila main sama, roundsSinceLastPlayed terkecil istirahat", () => {
    const ps = players(9).map((p) => ({ ...p, roundsSinceLastPlayed: p.id === "p7" ? 0 : 1 }));
    for (let seed = 0; seed < 20; seed++) {
      expect(planRound({ players: ps, courts: 2, format: "doubles" }, seed).resting).toEqual(["p7"]);
    }
  });

  it("3 pemain ganda → courts=[], hint 'bisa tunggal'", () => {
    const plan = planRound({ players: players(3), courts: 1, format: "doubles" }, 1);
    expect(plan.courts).toEqual([]);
    expect(plan.hint).toBe("bisa tunggal");
    expect([...plan.resting].sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("4 pemain, partnerCountSession(1,2)=3 → (1,2) tidak dipasangkan", () => {
    const history = historyFrom({ "p1|p2": 3 });
    for (let seed = 0; seed < 20; seed++) {
      const plan = planRound({ players: players(4), courts: 1, format: "doubles", history }, seed);
      expect(together(plan, "p1", "p2")).toBe(false);
    }
  });

  it("seed sama + input sama → output identik; seed beda boleh beda", () => {
    const input = { players: players(14), courts: 3, format: "doubles" as const };
    expect(planRound(input, 7)).toEqual(planRound(input, 7));
    const outputs = new Set(
      Array.from({ length: 10 }, (_, seed) => JSON.stringify(planRound(input, seed))),
    );
    expect(outputs.size).toBeGreaterThan(1);
  });
});

describe("planRound — property test (200 input acak ber-seed)", () => {
  it("tidak ada pemain ganda, |playing| = m·perMatch, |playing| + |resting| = N, adil", () => {
    const rnd = mulberry32(2026);
    const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
    for (let i = 0; i < 200; i++) {
      const n = int(2, 30);
      const courts = int(1, 5);
      const format = rnd() < 0.75 ? ("doubles" as const) : ("singles" as const);
      const ps = Array.from({ length: n }, (_, k) =>
        player(`m${k}`, {
          rating: 1 + rnd() * 3,
          playedThisSession: int(0, 4),
          roundsSinceLastPlayed: int(0, 3),
        }),
      );
      const salt = int(0, 1_000_000);
      const count = (kind: number, max: number) => (a: string, b: string) => {
        const key = (a < b ? a + b : b + a) + kind;
        let h = salt;
        for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
        return h % (max + 1);
      };
      const history: PairHistory = {
        partnerCountSession: count(1, 2),
        partnerCountAllTime: count(2, 9),
        opponentCount: count(3, 3),
      };

      const plan = planRound({ players: ps, courts, format, history }, i);
      const perMatch = format === "doubles" ? 4 : 2;
      const m = Math.min(courts, Math.floor(n / perMatch));
      const play = playing(plan);

      expect(plan.courts).toHaveLength(m);
      expect(play).toHaveLength(m * perMatch);
      expect(new Set([...play, ...plan.resting]).size).toBe(n);
      expect(play.length + plan.resting.length).toBe(n);
      for (const c of plan.courts) {
        expect(c.A).toHaveLength(perMatch / 2);
        expect(c.B).toHaveLength(perMatch / 2);
      }
      // fairness: tidak ada yang istirahat sementara pemain yang lebih sering main ikut main
      const played = new Map(ps.map((p) => [p.id, p.playedThisSession]));
      const maxPlaying = Math.max(-1, ...play.map((id) => played.get(id)!));
      const minResting = Math.min(99, ...plan.resting.map((id) => played.get(id)!));
      if (m > 0) expect(maxPlaying).toBeLessThanOrEqual(minResting);
    }
  });
});

describe("planRound — tambahan", () => {
  it("tim seimbang: rating 4,4,1,1 → tiap tim satu kuat satu lemah", () => {
    const ps = [
      player("a", { rating: 4 }),
      player("b", { rating: 4 }),
      player("c", { rating: 1 }),
      player("d", { rating: 1 }),
    ];
    for (let seed = 0; seed < 10; seed++) {
      const plan = planRound({ players: ps, courts: 1, format: "doubles" }, seed);
      expect(together(plan, "a", "b")).toBe(false);
      expect(together(plan, "c", "d")).toBe(false);
    }
  });

  it("m > 1: local search menghindari pasangan yang sudah dipakai di sesi", () => {
    const history = historyFrom({ "p1|p2": 1, "p3|p4": 1, "p5|p6": 1, "p7|p8": 1 });
    for (let seed = 0; seed < 20; seed++) {
      const plan = planRound({ players: players(8), courts: 2, format: "doubles", history }, seed);
      for (const [a, b] of [
        ["p1", "p2"],
        ["p3", "p4"],
        ["p5", "p6"],
        ["p7", "p8"],
      ]) {
        expect(together(plan, a, b)).toBe(false);
      }
    }
  });

  it("tunggal: lawan berdekatan rating", () => {
    const ps = [
      player("a", { rating: 4 }),
      player("b", { rating: 1 }),
      player("c", { rating: 3 }),
      player("d", { rating: 2 }),
    ];
    const plan = planRound({ players: ps, courts: 2, format: "singles" }, 3);
    const matchups = plan.courts.map((c) => [...c.A, ...c.B].sort().join());
    expect(matchups.sort()).toEqual(["a,c", "b,d"]);
  });

  it("tunggal: hindari lawan yang paling sering dihadapi", () => {
    const ps = [player("a", { rating: 3 }), player("b", { rating: 3 }), player("c", { rating: 3 }), player("d", { rating: 3 })];
    const history: PairHistory = {
      ...EMPTY_HISTORY,
      opponentCount: (x, y) => ([x, y].sort().join() === "a,b" ? 5 : 0),
    };
    for (let seed = 0; seed < 10; seed++) {
      const plan = planRound({ players: ps, courts: 2, format: "singles", history }, seed);
      expect(plan.courts.some((c) => [...c.A, ...c.B].sort().join() === "a,b")).toBe(false);
    }
  });

  it("hint: kurang pemain, tidak ada lapangan, pemain ganda", () => {
    expect(planRound({ players: players(1), courts: 1, format: "singles" }, 0).hint).toBe("kurang pemain");
    expect(planRound({ players: players(1), courts: 1, format: "doubles" }, 0).hint).toBe("kurang pemain");
    expect(planRound({ players: players(2), courts: 1, format: "doubles" }, 0).hint).toBe("bisa tunggal");
    const none = planRound({ players: players(8), courts: 0, format: "doubles" }, 0);
    expect(none).toMatchObject({ courts: [], hint: "tidak ada lapangan" });
    expect(none.resting).toHaveLength(8);
    expect(() =>
      planRound({ players: [player("x"), player("x")], courts: 1, format: "singles" }, 0),
    ).toThrow(RangeError);
  });

  it("lapangan lebih banyak dari yang bisa diisi → m = floor(n / 4)", () => {
    const plan = planRound({ players: players(10), courts: 5, format: "doubles" }, 0);
    expect(plan.courts).toHaveLength(2);
    expect(plan.resting).toHaveLength(2);
  });
});

describe("playerRating (§4.2 langkah 4)", () => {
  it("grade A–D → 4..1", () => {
    expect(["A", "B", "C", "D"].map((g) => playerRating(g as "A"))).toEqual([4, 3, 2, 1]);
  });

  it("tanpa grade → 1 + 3·winRate; pemain baru 2.5", () => {
    expect(playerRating(null, { played: 4, won: 3 })).toBe(3.25);
    expect(playerRating(null, { played: 0, won: 0 })).toBe(2.5);
    expect(playerRating(undefined)).toBe(2.5);
  });
});

describe("kocokContext — input planRound dari data match", () => {
  const at = new Date("2026-10-09T12:00:00Z");
  const m = (id: string, order: number, A: string[], B: string[], winner: "A" | "B" | null, extra: Partial<MatchRecord> = {}): MatchRecord => ({
    id,
    sessionId: "s1",
    sessionDate: at,
    order,
    kind: A.length === 2 ? "doubles" : "singles",
    status: winner ? "completed" : "running",
    players: { A, B },
    games: [{ a: winner === "B" ? 15 : 21, b: winner === "B" ? 21 : 15 }],
    winner,
    ...extra,
  });

  const session = [
    m("1", 1, ["a", "b"], ["c", "d"], "A"),
    m("2", 2, ["a", "c"], ["e", "f"], "B"),
    m("3", 3, ["b", "e"], ["g", "h"], null), // sedang main
    m("v", 4, ["a", "b"], ["e", "g"], "A", { status: "void" }),
  ];
  const earlier = [
    m("x", 1, ["a", "b"], ["e", "f"], "A", { sessionId: "s0" }),
    m("y", 2, ["c", "d"], ["a", "b"], "B", { sessionId: "s0" }),
  ];
  const ctx = kocokContext({
    candidates: [
      { id: "a", grade: null },
      { id: "c", grade: "B" },
      { id: "d", grade: null },
      { id: "z", grade: null },
    ],
    sessionMatches: session,
    groupMatches: [...earlier, ...session],
  });
  const byId = Object.fromEntries(ctx.players.map((p) => [p.id, p]));

  it("main di sesi ini & ronde sejak terakhir main (match void diabaikan, match berjalan tidak dihitung main)", () => {
    expect(byId.a).toMatchObject({ playedThisSession: 2, roundsSinceLastPlayed: 0 });
    expect(byId.d).toMatchObject({ playedThisSession: 1, roundsSinceLastPlayed: 1 });
    expect(byId.z).toMatchObject({ playedThisSession: 0, roundsSinceLastPlayed: 3 });
  });

  it("rating: grade bila ada, selain itu dari win rate ganda all-time", () => {
    expect(byId.c.rating).toBe(3); // grade B
    // a: x menang, y menang (sisi B), 1 menang, 2 kalah → 3/4
    expect(byId.a.rating).toBe(1 + 3 * 0.75);
    // d: y kalah, 1 kalah → 0/2
    expect(byId.d.rating).toBe(1);
    expect(byId.z.rating).toBe(2.5);
  });

  it("riwayat pasangan: sesi (termasuk yang berjalan), all-time (selesai), lawan sesi", () => {
    expect(ctx.history.partnerCountSession("a", "b")).toBe(1);
    expect(ctx.history.partnerCountSession("e", "b")).toBe(1);
    expect(ctx.history.partnerCountAllTime("b", "a")).toBe(3);
    expect(ctx.history.opponentCount("a", "e")).toBe(1);
    expect(ctx.history.opponentCount("a", "g")).toBe(0);
  });
});
