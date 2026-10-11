import { describe, expect, it } from "vitest";
import { mulberry32 } from "./kocok";
import {
  applyRounding,
  billPeople,
  billProgress,
  reconcileSettlements,
  type SettlementState,
  computeNet,
  courtCost,
  debtRange,
  settle,
  shareExpense,
  shuttleCost,
  splitBill,
  type Expense,
} from "./split";

const sum = (values: Iterable<number>) => [...values].reduce((s, v) => s + v, 0);
const RAKA = "raka";
const EIGHT = [RAKA, "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
const OTHERS = EIGHT.slice(1);

const expense = (id: string, amount: number, paidBy: string, over: Partial<Expense> = {}): Expense => ({
  id,
  amount,
  paidBy,
  mode: "equal",
  ...over,
});

describe("test vector §5 #1 — dasar", () => {
  const expenses = [expense("lapangan", 240_000, RAKA), expense("kok", 40_000, RAKA)];

  it("per orang 35000, Raka net −245000, tiap lainnya +35000, Σ net = 0", () => {
    const net = computeNet(expenses, EIGHT);
    expect(net.get(RAKA)).toBe(-245_000);
    for (const id of OTHERS) expect(net.get(id)).toBe(35_000);
    expect(sum(net.values())).toBe(0);
  });

  it("settle = 7 transfer × 35000 ke Raka", () => {
    const rounded = applyRounding(computeNet(expenses, EIGHT), 500, RAKA);
    expect(settle(rounded)).toEqual(OTHERS.map((from) => ({ from, to: RAKA, amount: 35_000 })));
  });
});

describe("test vector §5 #2 — pembulatan", () => {
  const expenses = [expense("lapangan", 240_000, RAKA), expense("kok", 25_000, RAKA)];

  it("share mentah 33125 → debitur 33500, kelebihan 2625 ke Raka, net Raka −234500", () => {
    const net = computeNet(expenses, EIGHT);
    for (const id of OTHERS) expect(net.get(id)).toBe(33_125);
    const rounded = applyRounding(net, 500, RAKA);
    for (const id of OTHERS) expect(rounded.get(id)).toBe(33_500);
    expect(sum(OTHERS.map((id) => rounded.get(id)!))).toBe(234_500);
    expect(rounded.get(RAKA)).toBe(-234_500);
    expect(rounded.get(RAKA)! - net.get(RAKA)!).toBe(-2_625);
    expect(sum(rounded.values())).toBe(0);
  });

  it("7 transfer × 33500; cocok dengan ceil(total/n/500)*500 di layar Create", () => {
    const bill = splitBill({ participants: EIGHT, expenses, hostId: RAKA, roundTo: 500 });
    expect(bill.transfers).toEqual(OTHERS.map((from) => ({ from, to: RAKA, amount: 33_500 })));
    expect(bill.total).toBe(265_000);
    expect(Math.ceil(265_000 / 8 / 500) * 500).toBe(33_500);
  });
});

describe("test vector §5 #3 — sisa pembagian", () => {
  it("100000 equal ke 3 → [33334, 33333, 33333] mengikuti urutan id", () => {
    const shares = shareExpense(expense("x", 100_000, "a"), ["c", "a", "b"]);
    expect([...shares]).toEqual([
      ["a", 33_334],
      ["b", 33_333],
      ["c", 33_333],
    ]);
  });
});

describe("test vector §5 #4 — beberapa penalang", () => {
  const people = ["A", "B", "C", "D"];
  const expenses = [expense("lapangan", 200_000, "A"), expense("kok", 60_000, "B")];

  it("share 65000; net A −135000, B +5000, C +65000, D +65000", () => {
    const net = computeNet(expenses, people);
    expect(Object.fromEntries(net)).toEqual({ A: -135_000, B: 5_000, C: 65_000, D: 65_000 });
  });

  it("settle ≤ 3 transfer: C→A 65000, D→A 65000, B→A 5000", () => {
    const rounded = applyRounding(computeNet(expenses, people), 1, "A");
    expect(settle(rounded)).toEqual([
      { from: "C", to: "A", amount: 65_000 },
      { from: "D", to: "A", amount: 65_000 },
      { from: "B", to: "A", amount: 5_000 },
    ]);
  });
});

describe("test vector §5 #5 — custom tak seimbang", () => {
  it("Σ shares ≠ amount → RangeError", () => {
    expect(() =>
      shareExpense(expense("x", 100_000, "a", { mode: "custom", shares: { a: 50_000, b: 40_000 } }), ["a", "b"]),
    ).toThrow(RangeError);
  });

  it("custom seimbang diterima apa adanya", () => {
    const shares = shareExpense(
      expense("x", 100_000, "a", { mode: "custom", shares: { b: 60_000, a: 40_000 } }),
      ["a", "b"],
    );
    expect(Object.fromEntries(shares)).toEqual({ a: 40_000, b: 60_000 });
  });
});

describe("test vector §5 #6 — property (input acak ber-seed)", () => {
  it("Σ net = 0 sebelum & sesudah pembulatan; transfer integer > 0", () => {
    const rnd = mulberry32(5);
    const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
    for (let i = 0; i < 300; i++) {
      const n = int(1, 16);
      const people = Array.from({ length: n }, (_, k) => `m${k}`);
      const host = people[int(0, n - 1)];
      const expenses: Expense[] = Array.from({ length: int(1, 5) }, (_, k) => {
        const amount = int(1, 2_000_000);
        const paidBy = people[int(0, n - 1)];
        const roll = rnd();
        if (roll < 0.5) {
          const members = people.filter(() => rnd() < 0.7);
          return expense(`e${k}`, amount, paidBy, members.length ? { members } : {});
        }
        if (roll < 0.75) {
          const weights = Object.fromEntries(people.map((p) => [p, int(0, 180)]));
          weights[people[0]] += 1; // pastikan Σ bobot > 0
          return expense(`e${k}`, amount, paidBy, { mode: "weighted", weights });
        }
        let left = amount;
        const shares: Record<string, number> = {};
        people.forEach((p, idx) => {
          const v = idx === n - 1 ? left : int(0, left);
          shares[p] = v;
          left -= v;
        });
        return expense(`e${k}`, amount, paidBy, { mode: "custom", shares });
      });
      const roundTo = [1, 500, 1000][int(0, 2)];

      for (const e of expenses) expect(sum(shareExpense(e, people).values())).toBe(e.amount);
      const net = computeNet(expenses, people);
      expect(sum(net.values())).toBe(0);
      const rounded = applyRounding(net, roundTo, host);
      expect(sum(rounded.values())).toBe(0);
      for (const [id, v] of rounded) {
        if (v <= 0) continue;
        expect(v % roundTo).toBe(0);
        expect(v - net.get(id)!).toBeLessThan(roundTo);
      }

      const transfers = settle(rounded);
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, n - 1));
      const balance = new Map(rounded);
      for (const t of transfers) {
        expect(Number.isInteger(t.amount) && t.amount > 0).toBe(true);
        balance.set(t.from, balance.get(t.from)! - t.amount);
        balance.set(t.to, balance.get(t.to)! + t.amount);
      }
      expect([...balance.values()].every((v) => v === 0)).toBe(true);
    }
  });
});

describe("shareExpense — tambahan", () => {
  it("equal ke peserta terpilih saja", () => {
    const shares = shareExpense(expense("x", 30_000, "a", { members: ["b", "c"] }), ["a", "b", "c"]);
    expect(Object.fromEntries(shares)).toEqual({ b: 15_000, c: 15_000 });
  });

  it("weighted: largest remainder, tie → id", () => {
    // 100 dibagi bobot 1:1:1 → 33.33 masing-masing, sisa 1 ke id terkecil
    const s1 = shareExpense(expense("x", 100, "a", { mode: "weighted", weights: { c: 1, a: 1, b: 1 } }), []);
    expect([...s1]).toEqual([
      ["a", 34],
      ["b", 33],
      ["c", 33],
    ]);
    // 1000 dibagi menit main 120:90:30 → 500, 375, 125
    const s2 = shareExpense(expense("x", 1000, "a", { mode: "weighted", weights: { a: 120, b: 90, c: 30 } }), []);
    expect(Object.fromEntries(s2)).toEqual({ a: 500, b: 375, c: 125 });
    // 10 dibagi 3:3:1 → kuota 4.29, 4.29, 1.43 → sisa 1 ke sisa terbesar (a, b sama .29 < c .43)
    const s3 = shareExpense(expense("x", 10, "a", { mode: "weighted", weights: { a: 3, b: 3, c: 1 } }), []);
    expect(Object.fromEntries(s3)).toEqual({ a: 4, b: 4, c: 2 });
  });

  it("input tidak valid → RangeError", () => {
    expect(() => shareExpense(expense("x", 10.5, "a"), ["a"])).toThrow(RangeError);
    expect(() => shareExpense(expense("x", 0, "a"), ["a"])).toThrow(RangeError);
    expect(() => shareExpense(expense("x", 10, "a"), [])).toThrow(RangeError);
    expect(() => shareExpense(expense("x", 10, "a", { mode: "custom" }), ["a"])).toThrow(RangeError);
    expect(() =>
      shareExpense(expense("x", 10, "a", { mode: "custom", shares: { a: 11, b: -1 } }), ["a"]),
    ).toThrow(RangeError);
    expect(() =>
      shareExpense(expense("x", 10, "a", { mode: "weighted", weights: { a: 0 } }), ["a"]),
    ).toThrow(RangeError);
    expect(() =>
      shareExpense(expense("x", 10, "a", { mode: "weighted", weights: { a: 1.5 } }), ["a"]),
    ).toThrow(RangeError);
  });
});

describe("applyRounding & settle — tambahan", () => {
  it("host bukan kreditur → kelebihan ke kreditur |net| terbesar (tie id)", () => {
    const net = new Map([
      ["h", 100],
      ["x", -150],
      ["y", -150],
      ["z", 200],
    ]);
    const rounded = applyRounding(net, 500, "h");
    expect(Object.fromEntries(rounded)).toEqual({ h: 500, x: -150 - 700, y: -150, z: 500 });
  });

  it("roundTo tidak valid → RangeError", () => {
    expect(() => applyRounding(new Map(), 0, "h")).toThrow(RangeError);
  });

  it("settle menolak net yang Σ ≠ 0 atau pecahan", () => {
    expect(() => settle(new Map([["a", 1]]))).toThrow(RangeError);
    expect(() => settle(new Map([["a", 0.5], ["b", -0.5]]))).toThrow(RangeError);
    expect(settle(new Map())).toEqual([]);
  });

  it("biaya dibayar orang yang tidak hadir tetap dihitung sebagai kreditur", () => {
    const net = computeNet([expense("x", 9_000, "absen")], ["a", "b", "c"]);
    expect(Object.fromEntries(net)).toEqual({ a: 3_000, b: 3_000, c: 3_000, absen: -9_000 });
  });
});

describe("shuttleCost (§5.5)", () => {
  it("40000 per slop, 4 dipakai → 13400; 12 dipakai → 40000", () => {
    expect(shuttleCost({ pricePerSlop: 40_000, used: 4 })).toBe(13_400);
    expect(shuttleCost({ pricePerSlop: 40_000, used: 12 })).toBe(40_000);
    expect(shuttleCost({ pricePerSlop: 40_000, used: 0 })).toBe(0);
    expect(shuttleCost({ pricePerSlop: 36_000, used: 6, perSlop: 6 })).toBe(36_000);
  });

  it("input tidak valid → RangeError", () => {
    expect(() => shuttleCost({ pricePerSlop: 40_000, used: -1 })).toThrow(RangeError);
    expect(() => shuttleCost({ pricePerSlop: 40_000, used: 1, perSlop: 0 })).toThrow(RangeError);
  });
});

describe("courtCost (preset sewa lapangan, PRD P1)", () => {
  it("per jam × lapangan × durasi", () => {
    expect(courtCost({ perHour: 120_000, courts: 1, durationMin: 120 })).toBe(240_000);
    expect(courtCost({ perHour: 80_000, courts: 2, durationMin: 90 })).toBe(240_000);
    expect(courtCost({ perHour: 0, courts: 3, durationMin: 120 })).toBe(0);
  });

  it("pecahan rupiah dibulatkan ke atas", () => {
    expect(courtCost({ perHour: 1, courts: 1, durationMin: 30 })).toBe(1);
    expect(courtCost({ perHour: 75_001, courts: 1, durationMin: 90 })).toBe(112_502);
  });

  it("input tidak valid → RangeError", () => {
    expect(() => courtCost({ perHour: -1, courts: 1, durationMin: 60 })).toThrow(RangeError);
    expect(() => courtCost({ perHour: 1000, courts: 0, durationMin: 60 })).toThrow(RangeError);
    expect(() => courtCost({ perHour: 1000, courts: 1, durationMin: 1.5 })).toThrow(RangeError);
  });
});

describe("debtRange", () => {
  it("rentang nominal transfer debitur setelah pembulatan; null bila tak ada debitur", () => {
    const rounded = applyRounding(computeNet([expense("x", 100_000, "a")], ["a", "b", "c"]), 500, "a");
    expect(debtRange(rounded)).toEqual({ min: 33_500, max: 33_500, debtors: 2 });
    expect(debtRange(new Map([["a", -5], ["b", 2], ["c", 3]]))).toEqual({ min: 2, max: 3, debtors: 2 });
    expect(debtRange(new Map([["a", 0]]))).toBeNull();
  });
});

describe("reconcileSettlements — status lunas saat tagihan dihitung ulang", () => {
  const row = (from: string, amount: number, over: Partial<SettlementState> = {}): SettlementState => ({
    from,
    to: RAKA,
    amount,
    status: "unpaid",
    selfReported: false,
    paidAt: null,
    ...over,
  });
  const PAID = { status: "paid" as const, paidAt: "2026-10-09T15:00:00.000Z" };

  it("nominal sama → status dipertahankan; nominal berubah → direset dan dilaporkan", () => {
    const previous = [row("p2", 35000, PAID), row("p3", 35000, { selfReported: true }), row("p4", 35000), row("p5", 35000, PAID)];
    const transfers = [
      { from: "p2", to: RAKA, amount: 35000 },
      { from: "p3", to: RAKA, amount: 35000 },
      { from: "p4", to: RAKA, amount: 36000 },
      { from: "p5", to: RAKA, amount: 33500 },
    ];
    const { rows, reset } = reconcileSettlements(previous, transfers);
    expect(rows).toEqual([
      row("p2", 35000, PAID),
      row("p3", 35000, { selfReported: true }),
      row("p4", 36000),
      row("p5", 33500),
    ]);
    expect(reset).toEqual([row("p5", 35000, PAID)]);
  });

  it("penerima berubah atau transfer hilang → reset; transfer baru belum bayar", () => {
    const previous = [row("p2", 35000, PAID), row("p3", 35000, { selfReported: true })];
    const { rows, reset } = reconcileSettlements(previous, [{ from: "p2", to: "p9", amount: 35000 }]);
    expect(rows).toEqual([{ from: "p2", to: "p9", amount: 35000, status: "unpaid", selfReported: false, paidAt: null }]);
    expect(reset.map((r) => r.from)).toEqual(["p2", "p3"]);
    expect(reconcileSettlements([], [])).toEqual({ rows: [], reset: [] });
  });
});

describe("billProgress", () => {
  const s = (from: string, to: string, amount: number, status: "paid" | "unpaid", selfReported = false): SettlementState => ({
    from,
    to,
    amount,
    status,
    selfReported,
    paidAt: null,
  });

  it("vector #1 dengan 5 dari 7 lunas", () => {
    const rows = OTHERS.map((id, i) => s(id, RAKA, 35000, i < 5 ? "paid" : "unpaid", i === 5));
    expect(billProgress(rows)).toEqual({ total: 245000, collected: 175000, debtors: 7, paidDebtors: 5, awaiting: 1 });
  });

  it("debitur dengan dua transfer baru lunas bila keduanya lunas", () => {
    const rows = [s("c", "a", 60000, "paid"), s("c", "b", 5000, "unpaid"), s("d", "a", 65000, "paid")];
    expect(billProgress(rows)).toEqual({ total: 130000, collected: 125000, debtors: 2, paidDebtors: 1, awaiting: 0 });
    expect(billProgress([])).toEqual({ total: 0, collected: 0, debtors: 0, paidDebtors: 0, awaiting: 0 });
  });
});

describe("billPeople", () => {
  it("vector #2: bagian 33125, Raka menalangi 265000 dan menerima 7 × 33500", () => {
    const bill = splitBill({
      participants: EIGHT,
      expenses: [expense("court", 240000, RAKA), expense("kok", 25000, RAKA)],
      hostId: RAKA,
      roundTo: 500,
    });
    const shares = Object.fromEntries(EIGHT.map((id) => [id, 33125]));
    const people = billPeople([{ amount: 265000, paidBy: RAKA, shares }], bill.transfers);
    expect(people.find((p) => p.memberId === RAKA)).toEqual({ memberId: RAKA, share: 33125, paid: 265000, transfer: -234500 });
    expect(people.filter((p) => p.memberId !== RAKA).every((p) => p.share === 33125 && p.paid === 0 && p.transfer === 33500)).toBe(true);
    expect(sum(people.map((p) => p.transfer))).toBe(0);
  });

  it("penalang di luar peserta tetap muncul", () => {
    expect(billPeople([{ amount: 100, paidBy: "x", shares: { a: 100 } }], [{ from: "a", to: "x", amount: 100 }])).toEqual([
      { memberId: "a", share: 100, paid: 0, transfer: 100 },
      { memberId: "x", share: 0, paid: 100, transfer: -100 },
    ]);
  });
});
