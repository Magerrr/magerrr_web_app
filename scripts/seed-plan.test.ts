import { describe, expect, it } from "vitest";
import { isFinalScore } from "../src/lib/core/rules";
import type { MatchRecord } from "../src/lib/core/types";
import { MEMBERS, RULES, SESSIONS, planBill, planSessionMatches, winnerOf } from "./seed-plan";

const ids = MEMBERS.map((_, i) => `m${String(i).padStart(2, "0")}`);
const grades = new Map(MEMBERS.map((m, i) => [ids[i], m.grade]));

describe("rencana seed", () => {
  it("1 grup, 12 anggota, 3 sesi, 25 match", () => {
    expect(MEMBERS).toHaveLength(12);
    expect(SESSIONS).toHaveLength(3);
    expect(SESSIONS.reduce((s, x) => s + x.matches, 0)).toBe(25);
  });

  it("match sah: skor akhir valid, pemenang cocok, tidak ada pemain dua kali dalam satu ronde", () => {
    const history: MatchRecord[] = [];
    SESSIONS.forEach((session, si) => {
      const present = session.present.map((i) => ids[i]);
      const matches = planSessionMatches(`s${si}`, present, grades, session.matches, session.courts, history, 1000 + si);
      expect(matches).toHaveLength(session.matches);
      for (let i = 0; i < matches.length; i += session.courts) {
        const round = matches.slice(i, i + session.courts).flatMap((m) => [...m.players.A, ...m.players.B]);
        expect(new Set(round).size).toBe(round.length);
      }
      for (const m of matches) {
        expect(m.players.A).toHaveLength(2);
        expect(m.players.B).toHaveLength(2);
        expect([...m.players.A, ...m.players.B].every((id) => present.includes(id))).toBe(true);
        const [g] = m.games;
        expect(isFinalScore(g.a, g.b, RULES)).toBe(true);
        expect(winnerOf(g)).toBe(m.winner);
      }
    });
  });

  it("deterministik", () => {
    const present = SESSIONS[0].present.map((i) => ids[i]);
    expect(planSessionMatches("s", present, grades, 12, 2, [], 7)).toEqual(planSessionMatches("s", present, grades, 12, 2, [], 7));
  });

  it("patungan: Σ transfer = Σ utang, semua ke penalang", () => {
    const s = SESSIONS[1];
    const present = s.present.map((i) => ids[i]);
    const bill = planBill(present, s.expenses.map((e) => ({ amount: e.amount, paidBy: ids[e.paidBy] })), ids[0]);
    expect(bill.shares.reduce((x, r) => x + r.amount, 0)).toBe(321000);
    expect(bill.transfers.every((t) => Number.isInteger(t.amount) && t.amount > 0)).toBe(true);
    // Pembulatan berlaku pada total yang dibayar tiap debitur.
    const owed = new Map<string, number>();
    for (const t of bill.transfers) owed.set(t.from, (owed.get(t.from) ?? 0) + t.amount);
    expect([...owed.values()].every((v) => v % 500 === 0)).toBe(true);
    expect(new Set(bill.transfers.map((t) => t.to))).toEqual(new Set([ids[0], ids[1]]));
  });
});
