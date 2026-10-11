import { describe, expect, it } from "vitest";
import { counterpartBalances, memberBalances, type BalanceTransfer } from "./balance";

// Test vector ALGORITHMS §5.6
const VECTOR: BalanceTransfer[] = [
  { from: "p2", to: "p1", amount: 35000, status: "unpaid" },
  { from: "p3", to: "p1", amount: 35000, status: "paid" },
  { from: "p1", to: "p2", amount: 20000, status: "unpaid" },
  { from: "p3", to: "p2", amount: 10000, status: "unpaid" },
];

describe("memberBalances (§5.6)", () => {
  it("vector: utang terbesar dulu, Σ net = 0", () => {
    const rows = memberBalances(VECTOR);
    expect(rows).toEqual([
      { memberId: "p3", owes: 10000, owed: 0, net: -10000 },
      { memberId: "p2", owes: 35000, owed: 30000, net: -5000 },
      { memberId: "p1", owes: 20000, owed: 35000, net: 15000 },
    ]);
    expect(rows.reduce((sum, r) => sum + r.net, 0)).toBe(0);
  });

  it("semua lunas → kosong", () => {
    expect(memberBalances(VECTOR.map((t) => ({ ...t, status: "paid" as const })))).toEqual([]);
  });
});

describe("counterpartBalances (§5.6)", () => {
  it("vector p2: bersih per lawan, |net| terbesar dulu", () => {
    expect(counterpartBalances(VECTOR, "p2")).toEqual([
      { memberId: "p1", owes: 35000, owed: 20000, net: -15000, count: 2 },
      { memberId: "p3", owes: 0, owed: 10000, net: 10000, count: 1 },
    ]);
  });

  it("vector p3: transfer lunas tidak muncul; tanpa transfer → kosong", () => {
    expect(counterpartBalances(VECTOR, "p3")).toEqual([{ memberId: "p2", owes: 10000, owed: 0, net: -10000, count: 1 }]);
    expect(counterpartBalances(VECTOR, "p9")).toEqual([]);
  });

  it("saling utang sama besar → impas tetap muncul", () => {
    const even: BalanceTransfer[] = [
      { from: "a", to: "b", amount: 5000, status: "unpaid" },
      { from: "b", to: "a", amount: 5000, status: "unpaid" },
    ];
    expect(counterpartBalances(even, "a")).toEqual([{ memberId: "b", owes: 5000, owed: 5000, net: 0, count: 2 }]);
    expect(memberBalances(even).map((r) => r.net)).toEqual([0, 0]);
  });
});
