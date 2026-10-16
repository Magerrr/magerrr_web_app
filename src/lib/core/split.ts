// Patungan (docs/ALGORITHMS.md §5). PRD: P1–P4. Semua uang integer rupiah; tidak ada float.
import { compareId, type MemberId, type Rupiah } from "./types";

export type SplitMode = "equal" | "custom" | "weighted";

export interface Expense {
  id: string;
  amount: Rupiah;
  paidBy: MemberId;
  mode: SplitMode;
  /** equal: peserta terpilih; default semua peserta hadir */
  members?: MemberId[];
  /** custom: nominal per orang, Σ wajib = amount */
  shares?: Record<MemberId, Rupiah>;
  /** weighted: bobot integer >= 0 (mis. menit main), Σ > 0 */
  weights?: Record<MemberId, number>;
}

export interface Transfer {
  from: MemberId;
  to: MemberId;
  amount: Rupiah;
}

function assertRupiah(value: number, what: string, min = 0): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${what} harus integer rupiah >= ${min}, bukan ${value}`);
  }
}

const sortedEntries = <T>(record: Record<MemberId, T>) =>
  Object.entries(record).sort(([a], [b]) => compareId(a, b));

/** Bagi satu biaya. Hasil terurut memberId ↑ dan Σ = amount. */
export function shareExpense(expense: Expense, participants: MemberId[]): Map<MemberId, Rupiah> {
  const { amount } = expense;
  assertRupiah(amount, `biaya ${expense.id}`, 1);

  switch (expense.mode) {
    case "equal": {
      const members = [...new Set(expense.members ?? participants)].sort(compareId);
      if (members.length === 0) throw new RangeError(`biaya ${expense.id}: tidak ada peserta`);
      const base = Math.floor(amount / members.length);
      const remainder = amount - base * members.length;
      return new Map(members.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
    }

    case "custom": {
      if (!expense.shares) throw new RangeError(`biaya ${expense.id}: shares wajib untuk mode custom`);
      const entries = sortedEntries(expense.shares);
      entries.forEach(([id, v]) => assertRupiah(v, `bagian ${id}`));
      const total = entries.reduce((s, [, v]) => s + v, 0);
      if (total !== amount) {
        throw new RangeError(`biaya ${expense.id}: Σ bagian ${total} ≠ ${amount}`);
      }
      return new Map(entries);
    }

    case "weighted": {
      const entries = sortedEntries(expense.weights ?? {});
      entries.forEach(([id, w]) => assertRupiah(w, `bobot ${id}`));
      const totalWeight = entries.reduce((s, [, w]) => s + w, 0);
      if (totalWeight <= 0) throw new RangeError(`biaya ${expense.id}: Σ bobot harus > 0`);
      // Largest remainder dengan aritmetika integer: kuota = amount·w / Σw.
      const quotas = entries.map(([id, w], index) => {
        const numerator = amount * w;
        if (!Number.isSafeInteger(numerator)) throw new RangeError(`biaya ${expense.id}: angka terlalu besar`);
        const rest = numerator % totalWeight;
        return { id, index, share: (numerator - rest) / totalWeight, rest };
      });
      let left = amount - quotas.reduce((s, q) => s + q.share, 0);
      for (const q of [...quotas].sort((x, y) => y.rest - x.rest || x.index - y.index)) {
        if (left === 0) break;
        q.share++;
        left--;
      }
      return new Map(quotas.map((q) => [q.id, q.share]));
    }
  }
}

/** Netto per orang: Σ bagian − Σ yang dibayar. Positif = berutang, negatif = menalangi. Σ = 0. */
export function computeNet(expenses: Expense[], participants: MemberId[]): Map<MemberId, number> {
  const net = new Map<MemberId, number>(participants.map((id) => [id, 0]));
  const add = (id: MemberId, value: number) => net.set(id, (net.get(id) ?? 0) + value);
  for (const expense of expenses) {
    for (const [id, share] of shareExpense(expense, participants)) add(id, share);
    add(expense.paidBy, -expense.amount);
  }
  return net;
}

/**
 * Iuran flat (§5.7): tiap peserta berbagian `flatFee`; biaya ditanggung pengelola (`hostId`), penalang lain diganti
 * pengelola. Positif = berutang, negatif = menalangi/menerima. Σ = 0.
 */
export function flatNet(expenses: Expense[], participants: MemberId[], hostId: MemberId, flatFee: Rupiah): Map<MemberId, number> {
  assertRupiah(flatFee, "iuran flat", 1);
  const net = new Map<MemberId, number>(participants.map((id) => [id, flatFee]));
  for (const expense of expenses) {
    assertRupiah(expense.amount, `biaya ${expense.id}`, 1);
    net.set(expense.paidBy, (net.get(expense.paidBy) ?? 0) - expense.amount);
  }
  net.set(hostId, 0);
  let others = 0;
  for (const value of net.values()) others += value;
  net.set(hostId, -others);
  return net;
}

/** Bulatkan utang ke atas ke kelipatan roundTo; kelebihan dikreditkan ke host (atau kreditur terbesar). */
export function applyRounding(
  net: Map<MemberId, number>,
  roundTo: number,
  hostId: MemberId,
): Map<MemberId, number> {
  assertRupiah(roundTo, "roundTo", 1);
  const rounded = new Map(net);
  let excess = 0;
  for (const [id, value] of net) {
    if (value <= 0) continue;
    const rest = value % roundTo;
    if (rest === 0) continue;
    rounded.set(id, value + roundTo - rest);
    excess += roundTo - rest;
  }
  if (excess === 0) return rounded;

  // Σ net = 0 dan ada debitur → selalu ada kreditur.
  const creditor =
    (net.get(hostId) ?? 0) < 0
      ? hostId
      : [...net].filter(([, v]) => v < 0).sort(([a, x], [b, y]) => x - y || compareId(a, b))[0][0];
  rounded.set(creditor, rounded.get(creditor)! - excess);
  return rounded;
}

/** Transfer minimal secara greedy: debitur terbesar bayar ke kreditur terbesar, ulangi. */
export function settle(net: Map<MemberId, number>): Transfer[] {
  let total = 0;
  for (const [id, value] of net) {
    if (!Number.isSafeInteger(value)) throw new RangeError(`net ${id} harus integer, bukan ${value}`);
    total += value;
  }
  if (total !== 0) throw new RangeError(`Σ net harus 0, bukan ${total}`);

  const debtors = [...net].filter(([, v]) => v > 0).map(([id, v]) => ({ id, left: v }));
  const creditors = [...net].filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: -v }));
  const byLeft = (x: { id: string; left: number }, y: { id: string; left: number }) =>
    y.left - x.left || compareId(x.id, y.id);

  const transfers: Transfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byLeft);
    creditors.sort(byLeft);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.left, c.left);
    transfers.push({ from: d.id, to: c.id, amount });
    d.left -= amount;
    c.left -= amount;
    if (d.left === 0) debtors.shift();
    if (c.left === 0) creditors.shift();
  }
  return transfers;
}

export interface BillInput {
  participants: MemberId[];
  expenses: Expense[];
  hostId: MemberId;
  roundTo: number;
  /** iuran flat per peserta (§5.7); kosong = bagi rata */
  flatFee?: Rupiah | null;
}

export interface Bill {
  total: Rupiah;
  /** iuran flat: Σ iuran − total biaya (positif = kelebihan untuk pengelola); null = bagi rata */
  surplus: number | null;
  /** Σ bagian tiap orang sebelum pembulatan */
  shares: Map<MemberId, Rupiah>;
  net: Map<MemberId, number>;
  /** net setelah pembulatan; positif = yang harus ditransfer */
  rounded: Map<MemberId, number>;
  transfers: Transfer[];
}

/** shareExpense → computeNet → applyRounding → settle; dengan `flatFee`: flatNet → applyRounding → settle. */
export function splitBill({ participants, expenses, hostId, roundTo, flatFee }: BillInput): Bill {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const shares = new Map<MemberId, Rupiah>();
  if (flatFee != null) {
    for (const id of participants) shares.set(id, flatFee);
  } else {
    for (const expense of expenses) {
      for (const [id, share] of shareExpense(expense, participants)) {
        shares.set(id, (shares.get(id) ?? 0) + share);
      }
    }
  }
  const net = flatFee != null ? flatNet(expenses, participants, hostId, flatFee) : computeNet(expenses, participants);
  const rounded = applyRounding(net, roundTo, hostId);
  return {
    total,
    surplus: flatFee != null ? flatFee * new Set(participants).size - total : null,
    shares,
    net,
    rounded,
    transfers: settle(rounded),
  };
}

/** Biaya kok per slop, dibulatkan ke atas ke Rp100 (§5.5). */
export function shuttleCost({
  pricePerSlop,
  used,
  perSlop = 12,
}: {
  pricePerSlop: Rupiah;
  used: number;
  perSlop?: number;
}): Rupiah {
  assertRupiah(pricePerSlop, "harga per slop");
  assertRupiah(used, "kok terpakai");
  assertRupiah(perSlop, "isi per slop", 1);
  const numerator = pricePerSlop * used;
  const denominator = perSlop * 100;
  const rest = numerator % denominator;
  return ((numerator - rest) / denominator + (rest > 0 ? 1 : 0)) * 100;
}

/** Biaya sewa lapangan: tarif per jam × jumlah lapangan × durasi, dibulatkan ke atas ke rupiah. */
export function courtCost({
  perHour,
  courts,
  durationMin,
}: {
  perHour: Rupiah;
  courts: number;
  durationMin: number;
}): Rupiah {
  assertRupiah(perHour, "tarif per jam");
  assertRupiah(courts, "jumlah lapangan", 1);
  assertRupiah(durationMin, "durasi (menit)", 1);
  const numerator = perHour * courts * durationMin;
  const rest = numerator % 60;
  return (numerator - rest) / 60 + (rest > 0 ? 1 : 0);
}

/** Nominal terkecil & terbesar yang harus ditransfer debitur (untuk tampilan "RpX/org"). */
export function debtRange(rounded: Map<MemberId, number>): { min: Rupiah; max: Rupiah; debtors: number } | null {
  const debts = [...rounded.values()].filter((v) => v > 0);
  if (debts.length === 0) return null;
  return { min: Math.min(...debts), max: Math.max(...debts), debtors: debts.length };
}

export type PayStatus = "unpaid" | "paid";

/** Baris `settlements`: transfer hasil `settle` + status bayar yang ditandai manual. */
export interface SettlementState extends Transfer {
  status: PayStatus;
  /** pemain menekan "Saya sudah bayar"; menunggu konfirmasi admin */
  selfReported: boolean;
  /** ISO string; diberikan pemanggil (core tidak membaca jam) */
  paidAt: string | null;
}

const transferKey = (t: Transfer) => `${t.from}\u0000${t.to}`;

/**
 * Pasang transfer baru ke status lama: status (lunas / menunggu konfirmasi) dipertahankan hanya
 * bila pasangan from→to dan nominalnya sama persis; selain itu direset ke belum bayar.
 * `reset` = baris lama yang sudah lunas/dilaporkan tetapi statusnya hilang (untuk peringatan).
 */
export function reconcileSettlements(
  previous: SettlementState[],
  transfers: Transfer[],
): { rows: SettlementState[]; reset: SettlementState[] } {
  const old = new Map(previous.map((s) => [transferKey(s), s]));
  const kept = new Set<string>();
  const rows = transfers.map((t): SettlementState => {
    const before = old.get(transferKey(t));
    if (before && before.amount === t.amount) {
      kept.add(transferKey(t));
      return { ...t, status: before.status, selfReported: before.selfReported, paidAt: before.paidAt };
    }
    return { ...t, status: "unpaid", selfReported: false, paidAt: null };
  });
  const reset = previous.filter((s) => (s.status === "paid" || s.selfReported) && !kept.has(transferKey(s)));
  return { rows, reset };
}

export interface BillProgress {
  /** Σ nominal transfer */
  total: Rupiah;
  /** Σ nominal transfer yang sudah lunas */
  collected: Rupiah;
  /** orang yang harus transfer */
  debtors: number;
  /** debitur yang semua transfernya lunas */
  paidDebtors: number;
  /** transfer yang dilaporkan sudah dibayar, belum dikonfirmasi */
  awaiting: number;
}

export function billProgress(settlements: SettlementState[]): BillProgress {
  const byDebtor = new Map<MemberId, boolean>();
  let total = 0;
  let collected = 0;
  let awaiting = 0;
  for (const s of settlements) {
    total += s.amount;
    if (s.status === "paid") collected += s.amount;
    else if (s.selfReported) awaiting++;
    byDebtor.set(s.from, (byDebtor.get(s.from) ?? true) && s.status === "paid");
  }
  return {
    total,
    collected,
    debtors: byDebtor.size,
    paidDebtors: [...byDebtor.values()].filter(Boolean).length,
    awaiting,
  };
}

export interface PersonBill {
  memberId: MemberId;
  /** Σ bagian dari semua biaya (sebelum pembulatan) */
  share: Rupiah;
  /** Σ biaya yang ditalangi */
  paid: Rupiah;
  /** Σ transfer keluar − Σ transfer masuk (setelah pembulatan); positif = harus bayar */
  transfer: Rupiah;
}

/**
 * Rincian per orang dari bagian tersimpan dan transfer; urut memberId ↑ (UI mengurutkan ulang).
 * `flat` (§5.7): bagian tiap peserta = iuran, bukan bagian biaya.
 */
export function billPeople(
  expenses: { amount: Rupiah; paidBy: MemberId; shares: Record<MemberId, Rupiah> }[],
  transfers: Transfer[],
  flat?: { fee: Rupiah; participants: MemberId[] } | null,
): PersonBill[] {
  const people = new Map<MemberId, PersonBill>();
  const get = (memberId: MemberId) => {
    const row = people.get(memberId) ?? { memberId, share: 0, paid: 0, transfer: 0 };
    people.set(memberId, row);
    return row;
  };
  for (const e of expenses) {
    get(e.paidBy).paid += e.amount;
    if (!flat) for (const [id, amount] of Object.entries(e.shares)) get(id).share += amount;
  }
  if (flat) for (const id of flat.participants) get(id).share += flat.fee;
  for (const t of transfers) {
    get(t.from).transfer += t.amount;
    get(t.to).transfer -= t.amount;
  }
  return [...people.values()].sort((x, y) => compareId(x.memberId, y.memberId));
}
