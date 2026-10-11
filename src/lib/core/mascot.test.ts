import { describe, expect, it } from "vitest";
import { defaultOutfit, isUnlocked, jakartaWeek, kikoMood, levelProgress, memberXp, resolveOutfit, weeklyStreak } from "./mascot";
import type { MatchRecord } from "./types";

function match(id: string, A: string[], B: string[], a: number, b: number, extra: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id,
    sessionId: "s1",
    seasonId: null,
    sessionDate: new Date(Date.UTC(2026, 9, 9, 12)),
    order: 1,
    kind: A.length === 2 ? "doubles" : "singles",
    status: "completed",
    players: { A, B },
    games: [{ a, b }],
    winner: a > b ? "A" : "B",
    ...extra,
  };
}

// Test vector §2 (3 match) + 2 match minggu berikutnya; p1: M, M, K, K, M.
const MATCHES = [
  match("m1", ["p1", "p2"], ["p3", "p4"], 21, 15),
  match("m2", ["p1", "p3"], ["p2", "p4"], 21, 19),
  match("m3", ["p1", "p4"], ["p2", "p3"], 18, 21),
  match("n1", ["p2", "p4"], ["p1", "p3"], 21, 10),
  match("n2", ["p2", "p1"], ["p3", "p4"], 21, 17),
];

describe("memberXp", () => {
  it("100 per sesi hadir + 10 per match + 10 per menang", () => {
    expect(memberXp(MATCHES, "p1", 2)).toEqual({ sessions: 2, matches: 5, wins: 3, xp: 280 });
    expect(memberXp(MATCHES, "p4", 2)).toEqual({ sessions: 2, matches: 5, wins: 1, xp: 260 });
    expect(memberXp([], "p1", 0).xp).toBe(0);
  });

  it("match dibatalkan / berjalan tidak dihitung; tunggal dihitung", () => {
    const extra = [
      match("v", ["p1", "p2"], ["p3", "p4"], 21, 0, { status: "void" }),
      match("r", ["p1", "p2"], ["p3", "p4"], 3, 1, { status: "running", winner: null }),
      match("t", ["p1"], ["p2"], 21, 3),
    ];
    expect(memberXp([...MATCHES, ...extra], "p1", 2)).toEqual({ sessions: 2, matches: 6, wins: 4, xp: 300 });
  });

  it("jumlah sesi tidak sah ditolak", () => {
    expect(() => memberXp([], "p1", -1)).toThrow(RangeError);
    expect(() => memberXp([], "p1", 1.5)).toThrow(RangeError);
  });
});

describe("levelProgress", () => {
  it.each([
    [0, 1, "Anak Kucing", 500, 0],
    [499, 1, "Anak Kucing", 500, 0.998],
    [500, 2, "Kucing Muda", 1000, 0],
    [1240, 3, "Atlet", 1500, 0.48],
    [1500, 4, "Juara", null, 1],
    [99_999, 4, "Juara", null, 1],
  ])("%i XP → Lv %i %s", (xp, level, name, nextXp, ratio) => {
    const p = levelProgress(xp);
    expect(p.level).toBe(level);
    expect(p.name).toBe(name);
    expect(p.next?.minXp ?? null).toBe(nextXp);
    expect(p.ratio).toBeCloseTo(ratio, 3);
  });

  it("XP tidak sah ditolak", () => {
    expect(() => levelProgress(-1)).toThrow(RangeError);
    expect(() => levelProgress(0.5)).toThrow(RangeError);
  });
});

describe("weeklyStreak", () => {
  // 2026-10-05 Senin. Senin 00.00 WIB = Minggu 17.00 UTC.
  const wib = (day: number, hour = 19) => new Date(Date.UTC(2026, 9, day, hour - 7));

  it("minggu berganti Senin 00.00 WIB", () => {
    expect(jakartaWeek(new Date(Date.UTC(2026, 9, 4, 16, 59)))).toBe(jakartaWeek(wib(4)));
    expect(jakartaWeek(new Date(Date.UTC(2026, 9, 4, 17, 0)))).toBe(jakartaWeek(wib(4)) + 1);
    expect(jakartaWeek(wib(5, 0))).toBe(jakartaWeek(wib(11, 23)));
  });

  const fridays = [new Date(Date.UTC(2026, 8, 25, 12)), wib(2), wib(9)];

  it("tiga minggu berturut-turut; minggu ini tanpa sesi belum memutus streak", () => {
    expect(weeklyStreak(fridays, wib(10))).toBe(3);
    expect(weeklyStreak(fridays, wib(12, 8))).toBe(3);
    expect(weeklyStreak(fridays, wib(19, 8))).toBe(0);
  });

  it("minggu bolong memutus; beberapa sesi seminggu dihitung sekali; sesi setelah hari ini diabaikan", () => {
    expect(weeklyStreak([fridays[0], fridays[2]], wib(10))).toBe(1);
    expect(weeklyStreak([...fridays, wib(7), wib(8)], wib(10))).toBe(3);
    expect(weeklyStreak([...fridays, wib(16)], wib(10))).toBe(3);
    expect(weeklyStreak([], wib(10))).toBe(0);
  });
});

describe("kikoMood", () => {
  it.each([
    [0, "sleepy"],
    [1, "happy"],
    [3, "happy"],
    [4, "fire"],
    [12, "fire"],
  ] as const)("streak %i → %s", (streak, mood) => {
    expect(kikoMood(streak)).toBe(mood);
  });
});

describe("kostum", () => {
  it("kostum otomatis per level", () => {
    expect(defaultOutfit(1)).toEqual({ fur: "oranye", hat: "none", acc: "none", jersey: "none" });
    expect(defaultOutfit(2)).toEqual({ fur: "oranye", hat: "band", acc: "none", jersey: "none" });
    expect(defaultOutfit(3)).toEqual({ fur: "oranye", hat: "band", acc: "racket", jersey: "navy" });
    expect(defaultOutfit(4)).toEqual({ fur: "oranye", hat: "crown", acc: "racket", jersey: "navy" });
  });

  it("pilihan terkunci di bawah level-nya", () => {
    expect(isUnlocked("hat", "crown", 3)).toBe(false);
    expect(isUnlocked("hat", "crown", 4)).toBe(true);
    expect(isUnlocked("acc", "ball", 2)).toBe(true);
    expect(isUnlocked("jersey", "hijau", 2)).toBe(false);
    expect(isUnlocked("fur", "hitam", 1)).toBe(true);
  });

  it("pilihan tersimpan dipakai bila sah & terbuka; selain itu kostum otomatis", () => {
    expect(resolveOutfit(null, 3)).toEqual(defaultOutfit(3));
    expect(resolveOutfit({ fur: "hitam", hat: "none", acc: "shades", jersey: "koral" }, 3)).toEqual({ fur: "hitam", hat: "none", acc: "shades", jersey: "koral" });
    // Level turun (match dibatalkan): mahkota & jersey terkunci lagi.
    expect(resolveOutfit({ fur: "abu", hat: "crown", acc: "ball", jersey: "hijau" }, 2)).toEqual({ fur: "abu", hat: "band", acc: "ball", jersey: "none" });
    // Nilai tak dikenal / bukan string / sebagian.
    expect(resolveOutfit({ fur: "ungu", hat: 3, acc: "__proto__" }, 1)).toEqual(defaultOutfit(1));
    expect(resolveOutfit({ fur: "krem" }, 4)).toEqual({ ...defaultOutfit(4), fur: "krem" });
  });
});
