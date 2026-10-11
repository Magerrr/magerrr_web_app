import "server-only";
import { randomUUID } from "node:crypto";
import { billText } from "@/lib/bill-text";
import {
  billPeople,
  billProgress,
  reconcileSettlements,
  shareExpense,
  shuttleCost,
  splitBill,
  type BillProgress,
  type Expense,
  type PersonBill,
  type SettlementState,
  type SplitMode,
} from "@/lib/core/split";
import { compareId, type MemberId, type Rupiah } from "@/lib/core/types";
import { publicEnv } from "@/lib/env";
import { HttpError } from "@/lib/http-error";
import type { ExpenseInput } from "@/lib/validation";
import type { Json } from "./database.types";
import type { GroupSettings } from "./groups";
import { memberNames } from "./members";
import { listPaymentInfos, type PaymentInfo } from "./payments";
import { assertMembersOf, type SessionDetail } from "./sessions";
import { serviceClient } from "./supabase";

/** Biaya seperti tersimpan: nominal + bagian tiap orang hasil `shareExpense`. */
export interface StoredExpense {
  id: string;
  name: string;
  amount: Rupiah;
  paidBy: MemberId;
  mode: SplitMode;
  preset: string | null;
  meta: Json | null;
  /** rata ke semua peserta hadir (ikut kehadiran) */
  splitAll: boolean;
  shares: Record<MemberId, Rupiah>;
  /** hanya mode weighted */
  weights: Record<MemberId, number> | null;
}

export interface StoredSettlement extends SettlementState {
  id: string;
}

export interface BillState {
  version: number;
  /** penanggung sisa pembulatan (ALGORITHMS §5.3): pembuat sesi */
  hostId: MemberId;
  participants: MemberId[];
  expenses: StoredExpense[];
  settlements: StoredSettlement[];
}

interface ShareRow {
  expense_id: string;
  member_id: string;
  amount: number;
  weight: number | null;
}

export async function loadBill(session: SessionDetail): Promise<BillState> {
  const { data, error } = await serviceClient()
    .from("sessions")
    .select(
      "bill_version, expenses(id, name, amount, paid_by, mode, preset, meta, split_all, created_at, expense_shares(member_id, amount, weight)), settlements(id, from_member, to_member, amount, status, self_reported, paid_at)",
    )
    .eq("id", session.id)
    .single();
  if (error) throw error;
  const expenses = [...data.expenses]
    .sort((x, y) => x.created_at.localeCompare(y.created_at) || compareId(x.id, y.id))
    .map((e) => {
      const weighted = e.expense_shares.filter((s) => s.weight !== null);
      return {
        id: e.id,
        name: e.name,
        amount: e.amount,
        paidBy: e.paid_by,
        mode: e.mode,
        preset: e.preset,
        meta: e.meta,
        splitAll: e.split_all,
        shares: Object.fromEntries(e.expense_shares.map((s) => [s.member_id, s.amount])),
        weights: e.mode === "weighted" ? Object.fromEntries(weighted.map((s) => [s.member_id, s.weight!])) : null,
      };
    });
  return {
    version: data.bill_version,
    hostId: session.createdBy ?? expenses[0]?.paidBy ?? "",
    participants: [...session.presentIds].sort(compareId),
    expenses,
    // Urutan tampilan: penerima, lalu pembayar terbesar.
    settlements: data.settlements
      .map((s) => ({
        id: s.id,
        from: s.from_member,
        to: s.to_member,
        amount: s.amount,
        status: s.status,
        selfReported: s.self_reported,
        paidAt: s.paid_at,
      }))
      .sort((x, y) => compareId(x.to, y.to) || y.amount - x.amount || compareId(x.from, y.from)),
  };
}

export function coreExpense(e: StoredExpense): Expense {
  if (e.splitAll) return { id: e.id, amount: e.amount, paidBy: e.paidBy, mode: "equal" };
  switch (e.mode) {
    case "equal":
      return { id: e.id, amount: e.amount, paidBy: e.paidBy, mode: "equal", members: Object.keys(e.shares) };
    case "custom":
      return { id: e.id, amount: e.amount, paidBy: e.paidBy, mode: "custom", shares: e.shares };
    case "weighted":
      return { id: e.id, amount: e.amount, paidBy: e.paidBy, mode: "weighted", weights: e.weights ?? {} };
  }
}

interface ComputedBill {
  shares: ShareRow[];
  settlements: SettlementState[];
  reset: SettlementState[];
}

/** shareExpense → splitBill (computeNet → applyRounding → settle) → reconcileSettlements. */
function computeBill(state: BillState, expenses: StoredExpense[], participants: MemberId[], roundTo: number): ComputedBill {
  if (participants.length === 0 && expenses.some((e) => e.splitAll)) {
    throw new HttpError(422, "Minimal satu peserta hadir untuk membagi biaya rata.");
  }
  const core = expenses.map(coreExpense);
  const shares = core.flatMap((expense, i) =>
    [...shareExpense(expense, participants)].map(([member_id, amount]) => ({
      expense_id: expense.id,
      member_id,
      amount,
      weight: expenses[i].mode === "weighted" ? (expense.weights?.[member_id] ?? 0) : null,
    })),
  );
  const { transfers } = splitBill({ participants, expenses: core, hostId: state.hostId, roundTo });
  const { rows, reset } = reconcileSettlements(state.settlements, transfers);
  return { shares, settlements: rows, reset };
}

/** Tagihan tersimpan berbeda dari hasil hitung sekarang (mis. pembulatan grup diubah, data lama). */
export function isStale(state: BillState, roundTo: number): boolean {
  try {
    const fresh = computeBill(state, state.expenses, state.participants, roundTo);
    const key = (rows: { a: string; b: string; n: number }[]) =>
      rows
        .map((r) => `${r.a}/${r.b}/${r.n}`)
        .sort()
        .join(",");
    const storedShares = state.expenses.flatMap((e) => Object.entries(e.shares).map(([m, n]) => ({ a: e.id, b: m, n })));
    return (
      key(fresh.shares.map((s) => ({ a: s.expense_id, b: s.member_id, n: s.amount }))) !== key(storedShares) ||
      key(fresh.settlements.map((s) => ({ a: s.from, b: s.to, n: s.amount }))) !==
        key(state.settlements.map((s) => ({ a: s.from, b: s.to, n: s.amount })))
    );
  } catch {
    return true;
  }
}

function dbError(error: { message: string }): never {
  if (error.message.includes("bill_conflict")) {
    throw new HttpError(409, "Tagihan baru saja diubah di perangkat lain. Muat ulang halaman lalu coba lagi.");
  }
  if (error.message.includes("expense_not_found")) throw new HttpError(404, "Biaya tidak ditemukan.");
  throw error;
}

async function persist(
  state: BillState,
  sessionId: string,
  actorId: string | null,
  op: "create" | "update" | "delete" | "recompute",
  expense: StoredExpense | { id: string } | null,
  computed: ComputedBill,
  present: MemberId[] | null,
): Promise<{ reset: SettlementState[] }> {
  const row =
    expense && "amount" in expense
      ? {
          id: expense.id,
          name: expense.name,
          amount: expense.amount,
          paid_by: expense.paidBy,
          mode: expense.mode,
          preset: expense.preset,
          meta: expense.meta,
          split_all: expense.splitAll,
        }
      : expense;
  const { error } = await serviceClient(actorId ?? undefined).rpc("save_bill", {
    p_session: sessionId,
    p_op: op,
    p_expense: row as Json,
    p_shares: computed.shares as unknown as Json,
    p_settlements: computed.settlements.map((s) => ({
      from: s.from,
      to: s.to,
      amount: s.amount,
      status: s.status,
      self_reported: s.selfReported,
      paid_at: s.paidAt,
    })),
    // null → kehadiran tidak diubah
    p_present: present as string[],
    p_version: state.version,
  });
  if (error) dbError(error);
  return { reset: computed.reset };
}

/** Tambah (expenseId kosong) atau ubah biaya. Panggil hanya setelah requireAdmin. */
export async function saveExpense(
  group: GroupSettings,
  session: SessionDetail,
  actorId: string,
  input: ExpenseInput,
  expenseId?: string,
  /** rincian preset yang ditulis sistem (mis. penghitung kok); default: pertahankan yang lama */
  meta?: Json,
): Promise<{ id: string; reset: SettlementState[] }> {
  const state = await loadBill(session);
  const existing = expenseId ? state.expenses.find((e) => e.id === expenseId) : undefined;
  if (expenseId && !existing) throw new HttpError(404, "Biaya tidak ditemukan.");
  await assertMembersOf(group.id, [input.paidBy], "Pembayar harus anggota grup ini.");

  const present = new Set(state.participants);
  const split = input.split;
  const splitMembers =
    split.mode === "all" ? [] : split.mode === "equal" ? split.members : Object.keys(split.mode === "custom" ? split.shares : split.weights);
  if (splitMembers.some((id) => !present.has(id))) {
    throw new HttpError(422, "Biaya hanya bisa dibagi ke peserta yang hadir.");
  }

  const expense: StoredExpense = {
    id: existing?.id ?? randomUUID(),
    name: input.name,
    amount: input.amount,
    paidBy: input.paidBy,
    mode: split.mode === "all" ? "equal" : split.mode,
    preset: input.preset,
    // Rincian preset (mis. tarif sewa per jam) hanya berlaku selama presetnya sama.
    meta: meta !== undefined ? meta : existing && existing.preset === input.preset ? existing.meta : null,
    splitAll: split.mode === "all",
    shares: split.mode === "custom" ? split.shares : split.mode === "equal" ? Object.fromEntries(split.members.map((m) => [m, 0])) : {},
    weights: split.mode === "weighted" ? split.weights : null,
  };
  const expenses = existing ? state.expenses.map((e) => (e.id === existing.id ? expense : e)) : [...state.expenses, expense];
  const computed = computeBill(state, expenses, state.participants, group.roundTo);
  const { reset } = await persist(state, session.id, actorId, existing ? "update" : "create", expense, computed, null);
  return { id: expense.id, reset };
}

export async function deleteExpense(
  group: GroupSettings,
  session: SessionDetail,
  actorId: string,
  expenseId: string,
): Promise<{ reset: SettlementState[] }> {
  const state = await loadBill(session);
  if (!state.expenses.some((e) => e.id === expenseId)) throw new HttpError(404, "Biaya tidak ditemukan.");
  const expenses = state.expenses.filter((e) => e.id !== expenseId);
  const computed = computeBill(state, expenses, state.participants, group.roundTo);
  return persist(state, session.id, actorId, "delete", { id: expenseId }, computed, null);
}

/**
 * Hitung ulang tagihan dari biaya tersimpan, opsional sambil mengganti peserta hadir
 * (biaya "rata ke semua peserta hadir" ikut berubah).
 */
export async function recomputeBill(
  group: GroupSettings,
  session: SessionDetail,
  actorId: string | null,
  present?: MemberId[],
): Promise<{ reset: SettlementState[] }> {
  const state = await loadBill(session);
  const participants = present ? [...new Set(present)].sort(compareId) : state.participants;
  const computed = computeBill(state, state.expenses, participants, group.roundTo);
  return persist(state, session.id, actorId, "recompute", null, computed, present ? participants : null);
}

export type PaymentAction = "paid" | "unpaid" | "reject" | "self_report";

/** Ubah status satu transfer; `now` = waktu tandai lunas. */
export async function setPaymentStatus(
  sessionId: string,
  actorId: string | null,
  settlementId: string,
  action: PaymentAction,
  now: Date,
): Promise<void> {
  const { data, error } = await serviceClient(actorId ?? undefined).rpc("set_payment_status", {
    p_session: sessionId,
    p_settlement: settlementId,
    p_action: action,
    p_paid_at: now.toISOString(),
  });
  if (error) throw error;
  if (!data) {
    throw new HttpError(
      409,
      action === "self_report" ? "Tagihan ini sudah lunas atau sudah berubah. Muat ulang halaman." : "Status tagihan sudah berubah. Muat ulang halaman.",
    );
  }
}

export interface BillView {
  state: BillState;
  groupName: string;
  names: Record<string, string>;
  people: PersonBill[];
  progress: BillProgress;
  /** penerima transfer (atau penalang bila belum ada transfer) beserta info pembayarannya */
  payTo: { memberId: string; infos: PaymentInfo[] }[];
  publicUrl: string;
  text: string;
}

/** Semua yang ditampilkan halaman Patungan & tagihan publik. */
export async function loadBillView(group: { id: string; name: string }, session: SessionDetail): Promise<BillView> {
  const [state, names] = await Promise.all([loadBill(session), memberNames(group.id)]);
  const receivers = [...new Set(state.settlements.map((s) => s.to))];
  const payToIds = receivers.length > 0 ? receivers : [...new Set(state.expenses.map((e) => e.paidBy))];
  const infos = await listPaymentInfos(payToIds);
  const payTo = payToIds.map((memberId) => ({ memberId, infos: infos.filter((i) => i.memberId === memberId) }));
  const publicUrl = `${publicEnv().siteUrl}/s/${session.shareToken}/tagihan`;
  const nameOf = (id: string) => names[id] ?? "?";
  return {
    state,
    groupName: group.name,
    names,
    people: billPeople(state.expenses, state.settlements),
    progress: billProgress(state.settlements),
    payTo,
    publicUrl,
    text: billText({
      groupName: group.name,
      startsAt: session.startsAt,
      venue: session.venue,
      total: state.expenses.reduce((s, e) => s + e.amount, 0),
      participants: state.participants.length,
      transfers: state.settlements.map((s) => ({ from: nameOf(s.from), to: nameOf(s.to), amount: s.amount, paid: s.status === "paid" })),
      payTo: payTo.filter((p) => receivers.includes(p.memberId)).map((p) => ({ name: nameOf(p.memberId), infos: p.infos })),
      url: publicUrl,
    }),
  };
}

/** meta biaya kok dari penghitung (§5.5); dipakai untuk mengenali biaya ini saat sesi ditutup. */
export const SHUTTLE_COUNTER = "counter";

/**
 * Saat sesi ditutup: penghitung kok → satu biaya "Kok (N buah)" = shuttleCost, ditalangi pembuat sesi,
 * rata ke semua peserta hadir. Biaya kok dari penghitung yang sudah ada diperbarui, bukan diduplikasi.
 */
export async function addShuttleExpense(group: GroupSettings, session: SessionDetail, actorId: string): Promise<void> {
  const { pricePerSlop, perSlop, used } = session.shuttle;
  if (!pricePerSlop || used === 0) return;
  const amount = shuttleCost({ pricePerSlop, used, perSlop });
  if (amount === 0) return;
  const state = await loadBill(session);
  const existing = state.expenses.find((e) => (e.meta as { source?: string } | null)?.source === SHUTTLE_COUNTER);
  await saveExpense(
    group,
    session,
    actorId,
    { name: `Kok (${used} buah)`, amount, paidBy: existing?.paidBy ?? (state.hostId || actorId), preset: "shuttle", split: { mode: "all" } },
    existing?.id,
    { source: SHUTTLE_COUNTER, pricePerSlop, perSlop, used },
  );
}
