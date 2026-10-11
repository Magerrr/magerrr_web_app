// Rencana data demo (BUILD_PLAN Fase 8: 1 grup, 12 anggota, 3 sesi, 25 match). Murni & deterministik:
// susunan pemain memakai `planRound` (kocok), skor acak ber-seed yang selalu sah menurut aturan,
// patungan memakai `splitBill`. Penulisan ke database ada di scripts/seed.ts.
import { kocokContext, mulberry32, planRound, type Grade } from "../src/lib/core/kocok";
import { PRESETS, isFinalScore } from "../src/lib/core/rules";
import { shareExpense, splitBill, type Expense, type Transfer } from "../src/lib/core/split";
import type { GameScore, MatchRecord, MemberId, Side } from "../src/lib/core/types";

export const RULES = PRESETS.bwf21;
export const ROUND_TO = 500;

export const GROUP = { name: "Mabar Jumat Malam (demo)", emoji: "🏸" } as const;

/** Indeks 0 = host (akun demo, admin). */
export const MEMBERS: { name: string; grade: Grade }[] = [
  { name: "Raka", grade: "B" },
  { name: "Dimas", grade: "A" },
  { name: "Sinta", grade: "B" },
  { name: "Nara", grade: "C" },
  { name: "Alya", grade: "B" },
  { name: "Yoga", grade: "C" },
  { name: "Bayu", grade: "A" },
  { name: "Fikri", grade: "D" },
  { name: "Putri", grade: "C" },
  { name: "Gilang", grade: "B" },
  { name: "Wulan", grade: "D" },
  { name: "Hendra", grade: "C" },
];

export interface SeedExpense {
  name: string;
  preset: "court" | "shuttle" | "drink" | "parking" | null;
  amount: number;
  /** indeks MEMBERS */
  paidBy: number;
}

export interface SeedSession {
  /** hari sebelum tanggal seed dijalankan */
  daysAgo: number;
  venue: string;
  courts: number;
  status: "finished" | "running";
  /** indeks MEMBERS yang hadir */
  present: number[];
  matches: number;
  expenses: SeedExpense[];
  /** indeks transfer (urutan `planBill`) yang sudah lunas; "all" = semua */
  paid: number[] | "all";
  /** indeks transfer yang dilaporkan "sudah bayar", menunggu konfirmasi */
  selfReported: number[];
}

export const SESSIONS: SeedSession[] = [
  {
    daysAgo: 14,
    venue: "GOR Cendrawasih",
    courts: 2,
    status: "finished",
    present: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    matches: 12,
    expenses: [
      { name: "Sewa lapangan", preset: "court", amount: 240000, paidBy: 0 },
      { name: "Kok", preset: "shuttle", amount: 60000, paidBy: 0 },
    ],
    paid: "all",
    selfReported: [],
  },
  {
    daysAgo: 7,
    venue: "GOR Cendrawasih",
    courts: 2,
    status: "finished",
    present: [0, 1, 2, 3, 4, 6, 8, 9, 10, 11],
    matches: 8,
    expenses: [
      { name: "Sewa lapangan", preset: "court", amount: 240000, paidBy: 0 },
      { name: "Kok", preset: "shuttle", amount: 66000, paidBy: 1 },
      { name: "Air minum", preset: "drink", amount: 15000, paidBy: 0 },
    ],
    paid: [0, 1, 2, 3, 4],
    selfReported: [5],
  },
  {
    daysAgo: 0,
    venue: "GOR Mutiara",
    courts: 1,
    status: "running",
    present: [0, 1, 2, 4, 5, 7, 9, 11],
    matches: 5,
    expenses: [{ name: "Sewa lapangan", preset: "court", amount: 150000, paidBy: 0 }],
    paid: [],
    selfReported: [],
  },
];

export const winnerOf = (g: GameScore): Side => (g.a > g.b ? "A" : "B");

const RATING: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1 };

/** Skor akhir sah untuk satu game: kebanyakan 21–x, sesekali deuce 22–20 … 30–29. */
function gameScore(random: () => number, winner: Side): GameScore {
  const roll = random();
  let w: number;
  let l: number;
  if (roll < 0.15) {
    // deuce: 22–20 s.d. 29–27, atau 30–29 / 30–28
    w = 22 + Math.floor(random() * 9);
    l = w === 30 ? 28 + Math.floor(random() * 2) : w - 2;
  } else {
    w = RULES.target;
    l = 5 + Math.floor(random() * 15); // 5–19
  }
  const score = winner === "A" ? { a: w, b: l } : { a: l, b: w };
  if (!isFinalScore(score.a, score.b, RULES)) throw new Error(`skor seed tidak sah ${w}–${l}`);
  return score;
}

/**
 * Match ganda satu sesi, ronde demi ronde lewat `planRound` (seperti tombol "Kocok ronde").
 * `history` = match selesai sesi sebelumnya (untuk rating & pasangan all-time); tidak diubah.
 */
export function planSessionMatches(
  sessionId: string,
  present: MemberId[],
  grades: Map<MemberId, Grade>,
  count: number,
  courts: number,
  history: MatchRecord[],
  seed: number,
): MatchRecord[] {
  const random = mulberry32(seed);
  const matches: MatchRecord[] = [];
  for (let round = 0; matches.length < count; round++) {
    const { players, history: pairs } = kocokContext({
      candidates: present.map((id) => ({ id, grade: grades.get(id) ?? null })),
      sessionMatches: matches,
      groupMatches: [...history, ...matches],
    });
    const plan = planRound({ players, courts: Math.min(courts, count - matches.length), format: "doubles", history: pairs }, seed + round);
    if (plan.courts.length === 0) throw new Error(`ronde ${round}: ${plan.hint ?? "tidak ada susunan"}`);
    for (const teams of plan.courts) {
      // Tim dengan grade lebih tinggi lebih sering menang, tapi tidak selalu.
      const strength = (ids: MemberId[]) => ids.reduce((s, id) => s + RATING[grades.get(id) ?? "C"], 0);
      const pA = 0.5 + (strength(teams.A) - strength(teams.B)) * 0.08;
      const winner: Side = random() < pA ? "A" : "B";
      matches.push({
        id: `${sessionId}-m${matches.length + 1}`,
        sessionId,
        seasonId: null,
        sessionDate: new Date(0),
        order: matches.length + 1,
        kind: "doubles",
        status: "completed",
        players: { A: [...teams.A], B: [...teams.B] },
        games: [gameScore(random, winner)],
        winner,
      });
    }
  }
  return matches;
}

/** Bagian per orang tiap biaya (rata ke semua yang hadir) dan transfer minimal setelah pembulatan. */
export function planBill(
  present: MemberId[],
  expenses: { amount: number; paidBy: MemberId }[],
  hostId: MemberId,
): { shares: { expense: number; memberId: MemberId; amount: number }[]; transfers: Transfer[] } {
  const core: Expense[] = expenses.map((e, i) => ({ id: String(i), amount: e.amount, paidBy: e.paidBy, mode: "equal" }));
  const shares = core.flatMap((e, i) => [...shareExpense(e, present)].map(([memberId, amount]) => ({ expense: i, memberId, amount })));
  const { transfers } = splitBill({ participants: present, expenses: core, hostId, roundTo: ROUND_TO });
  return { shares, transfers };
}
