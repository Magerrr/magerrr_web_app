// Saldo utang/piutang lintas sesi (PRD P10, docs/ALGORITHMS.md §5.6). Hanya pencatatan; uang integer rupiah.
import type { PayStatus } from "./split";
import { compareId, type MemberId, type Rupiah } from "./types";

export interface BalanceTransfer {
  from: MemberId;
  to: MemberId;
  amount: Rupiah;
  status: PayStatus;
}

export interface MemberBalance {
  memberId: MemberId;
  /** belum dibayar ke orang lain */
  owes: Rupiah;
  /** belum diterima dari orang lain */
  owed: Rupiah;
  /** owed − owes; positif = akan menerima */
  net: number;
}

export interface CounterpartBalance extends MemberBalance {
  /** jumlah transfer belum lunas dengan lawan ini */
  count: number;
}

const unpaid = (transfers: BalanceTransfer[]) => transfers.filter((t) => t.status === "unpaid");

/** Saldo tiap anggota dari transfer belum lunas di semua sesi, utang terbesar dulu. */
export function memberBalances(transfers: BalanceTransfer[]): MemberBalance[] {
  const rows = new Map<MemberId, MemberBalance>();
  const row = (id: MemberId) => rows.get(id) ?? rows.set(id, { memberId: id, owes: 0, owed: 0, net: 0 }).get(id)!;
  for (const t of unpaid(transfers)) {
    row(t.from).owes += t.amount;
    row(t.to).owed += t.amount;
  }
  return [...rows.values()]
    .map((r) => ({ ...r, net: r.owed - r.owes }))
    .sort((x, y) => x.net - y.net || compareId(x.memberId, y.memberId));
}

/** Saldo bersih `memberId` terhadap tiap lawan; negatif = masih harus bayar ke lawan itu. */
export function counterpartBalances(transfers: BalanceTransfer[], memberId: MemberId): CounterpartBalance[] {
  const rows = new Map<MemberId, CounterpartBalance>();
  for (const t of unpaid(transfers)) {
    if (t.from !== memberId && t.to !== memberId) continue;
    const other = t.from === memberId ? t.to : t.from;
    const r = rows.get(other) ?? { memberId: other, owes: 0, owed: 0, net: 0, count: 0 };
    if (t.from === memberId) r.owes += t.amount;
    else r.owed += t.amount;
    r.count++;
    rows.set(other, r);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, net: r.owed - r.owes }))
    .sort((x, y) => Math.abs(y.net) - Math.abs(x.net) || compareId(x.memberId, y.memberId));
}
