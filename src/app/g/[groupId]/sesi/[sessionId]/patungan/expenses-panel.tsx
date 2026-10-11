"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, Card, Field, Notice, Segmented, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { shareExpense, type Expense, type SettlementState } from "@/lib/core/split";
import { formatRupiah } from "@/lib/format";
import { expenseSchema, type ExpenseInput, type ExpensePreset } from "@/lib/validation";

type Names = Record<string, string>;
type SplitKind = "all" | "equal" | "custom" | "weighted";

export interface ExpenseView {
  id: string;
  name: string;
  amount: number;
  paidBy: string;
  mode: "equal" | "custom" | "weighted";
  preset: string | null;
  splitAll: boolean;
  shares: Record<string, number>;
  weights: Record<string, number> | null;
}

const PRESETS: { value: ExpensePreset | null; label: string; name: string }[] = [
  { value: "court", label: "Sewa lapangan", name: "Sewa lapangan" },
  { value: "shuttle", label: "Kok", name: "Kok" },
  { value: "drink", label: "Minum", name: "Air minum" },
  { value: "parking", label: "Parkir", name: "Parkir" },
  { value: null, label: "Lainnya", name: "" },
];

const SPLIT_OPTIONS: { value: SplitKind; label: string }[] = [
  { value: "all", label: "Rata semua hadir" },
  { value: "equal", label: "Pilih peserta" },
  { value: "custom", label: "Nominal per orang" },
  { value: "weighted", label: "Bobot" },
];

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 9);
const toInt = (value: string) => (value === "" ? 0 : Number(value));
const nameOf = (names: Names, id: string) => names[id] ?? "?";

export function describeSplit(e: ExpenseView, names: Names): string {
  const count = Object.keys(e.shares).length;
  if (e.splitAll) return `Rata ke ${count} peserta hadir`;
  if (e.mode === "equal") return `Rata ke ${count} orang`;
  if (e.mode === "custom") return "Nominal per orang";
  const weights = e.weights ?? {};
  return `Bobot: ${Object.entries(weights)
    .filter(([, w]) => w > 0)
    .map(([id, w]) => `${nameOf(names, id)} ${w}`)
    .join(", ")}`;
}

/** Daftar biaya + tambah/ubah/hapus (admin). Peringatan reset status lunas bertahan setelah refresh. */
export function ExpensesPanel({
  groupId,
  sessionId,
  expenses,
  names,
  participants,
  payers,
  defaultPayer,
  isAdmin,
}: {
  groupId: string;
  sessionId: string;
  expenses: ExpenseView[];
  names: Names;
  /** peserta hadir, urut nama */
  participants: string[];
  /** semua anggota aktif yang bisa menalangi, urut nama */
  payers: string[];
  defaultPayer: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const router = useRouter();

  function done(reset: SettlementState[], text: string) {
    setEditing(null);
    setNotice(
      reset.length > 0
        ? {
            tone: "error",
            text: `${text} Status bayar direset karena nominal transfer berubah: ${reset
              .map((r) => `${nameOf(names, r.from)} ke ${nameOf(names, r.to)} (${formatRupiah(r.amount)})`)
              .join(", ")}. Tandai ulang setelah dicek.`,
          }
        : { tone: "info", text },
    );
    router.refresh();
  }

  async function remove(e: ExpenseView) {
    if (!window.confirm(`Hapus biaya "${e.name}" (${formatRupiah(e.amount)})?`)) return;
    const result = await sendJson<{ reset: SettlementState[] }>(`/api/groups/${groupId}/sessions/${sessionId}/expenses/${e.id}`, "DELETE");
    if (!result.ok) return setNotice({ tone: "error", text: result.error });
    done(result.data.reset, `Biaya "${e.name}" dihapus.`);
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const formProps = { groupId, sessionId, names, participants, payers, onCancel: () => setEditing(null), onDone: done };

  return (
    <div className="flex flex-col gap-3">
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {expenses.length === 0 ? (
        <Card>
          <p className="text-ui">Belum ada biaya.{isAdmin && " Tambahkan sewa lapangan, kok, atau biaya lain."}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="expenses">
          {expenses.map((e) =>
            editing === e.id ? (
              <li key={e.id}>
                <ExpenseForm {...formProps} initial={e} defaultPayer={e.paidBy} />
              </li>
            ) : (
              <li key={e.id} className="flex flex-col gap-2 rounded-2xl border border-ink-black bg-pure-white px-4 py-3" data-testid="expense-row">
                <div className="flex items-start gap-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-ui">{e.name}</span>
                    <span className="text-small">
                      Ditalangi {nameOf(names, e.paidBy)} · {describeSplit(e, names)}
                    </span>
                  </span>
                  <span className="text-lead tabular-nums">{formatRupiah(e.amount)}</span>
                </div>
                <details className="text-small">
                  <summary className="min-h-11 cursor-pointer content-center">Bagian tiap orang</summary>
                  <ul className="flex flex-col gap-1 pb-2" data-testid="expense-shares">
                    {Object.entries(e.shares)
                      .sort(([a], [b]) => nameOf(names, a).localeCompare(nameOf(names, b), "id"))
                      .map(([id, amount]) => (
                        <li key={id} className="flex justify-between gap-3 tabular-nums">
                          <span>{nameOf(names, id)}</span>
                          <span>{formatRupiah(amount)}</span>
                        </li>
                      ))}
                  </ul>
                </details>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditing(e.id)} disabled={editing !== null}>
                      Ubah
                    </Button>
                    <Button variant="secondary" onClick={() => remove(e)} disabled={editing !== null}>
                      Hapus
                    </Button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {expenses.length > 0 && (
        <p className="text-ui" data-testid="expense-total">
          Total biaya {formatRupiah(total)}
        </p>
      )}
      {isAdmin &&
        (editing === "new" ? (
          <ExpenseForm {...formProps} defaultPayer={defaultPayer} />
        ) : (
          <Button size="lg" variant="accent" onClick={() => setEditing("new")} disabled={editing !== null}>
            Tambah biaya
          </Button>
        ))}
    </div>
  );
}

function initialSplit(initial?: ExpenseView): SplitKind {
  if (!initial || initial.splitAll) return "all";
  return initial.mode;
}

function ExpenseForm({
  groupId,
  sessionId,
  names,
  participants,
  payers,
  defaultPayer,
  initial,
  onCancel,
  onDone,
}: {
  groupId: string;
  sessionId: string;
  names: Names;
  participants: string[];
  payers: string[];
  defaultPayer: string;
  initial?: ExpenseView;
  onCancel: () => void;
  onDone: (reset: SettlementState[], text: string) => void;
}) {
  const id = useId();
  const [preset, setPreset] = useState<ExpensePreset | null>((initial?.preset as ExpensePreset | null) ?? (initial ? null : "court"));
  const [name, setName] = useState(initial?.name ?? "Sewa lapangan");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? defaultPayer);
  const [split, setSplit] = useState<SplitKind>(initialSplit(initial));
  const [members, setMembers] = useState(
    new Set(initial && !initial.splitAll && initial.mode === "equal" ? Object.keys(initial.shares) : participants),
  );
  const [custom, setCustom] = useState<Record<string, string>>(
    initial?.mode === "custom" ? Object.fromEntries(Object.entries(initial.shares).map(([k, v]) => [k, String(v)])) : {},
  );
  const [weights, setWeights] = useState<Record<string, string>>(
    initial?.weights ? Object.fromEntries(Object.entries(initial.weights).map(([k, v]) => [k, String(v)])) : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function pickPreset(value: ExpensePreset | null) {
    const known = PRESETS.some((p) => p.name === name) || name.trim() === "";
    setPreset(value);
    if (known) setName(PRESETS.find((p) => p.value === value)?.name ?? "");
  }

  const pickedRecord = (record: Record<string, string>) =>
    Object.fromEntries(participants.filter((m) => record[m] !== undefined && record[m] !== "").map((m) => [m, toInt(record[m])]));

  const raw = {
    name: name.trim(),
    amount: toInt(amount),
    paidBy,
    preset,
    split:
      split === "all"
        ? { mode: "all" as const }
        : split === "equal"
          ? { mode: "equal" as const, members: participants.filter((m) => members.has(m)) }
          : split === "custom"
            ? { mode: "custom" as const, shares: pickedRecord(custom) }
            : { mode: "weighted" as const, weights: pickedRecord(weights) },
  };
  const parsed = expenseSchema.safeParse(raw);
  const input: ExpenseInput | null = parsed.success ? parsed.data : null;

  // Pratinjau bagian memakai fungsi inti yang sama dengan server.
  const preview = (() => {
    if (!input) return null;
    const s = input.split;
    const expense: Expense =
      s.mode === "all"
        ? { id: "x", amount: input.amount, paidBy, mode: "equal" }
        : s.mode === "equal"
          ? { id: "x", amount: input.amount, paidBy, mode: "equal", members: s.members }
          : s.mode === "custom"
            ? { id: "x", amount: input.amount, paidBy, mode: "custom", shares: s.shares }
            : { id: "x", amount: input.amount, paidBy, mode: "weighted", weights: s.weights };
    try {
      return shareExpense(expense, participants);
    } catch {
      return null;
    }
  })();

  const customTotal = Object.values(pickedRecord(custom)).reduce((s, v) => s + v, 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Data belum lengkap.");
    setPending(true);
    const url = `/api/groups/${groupId}/sessions/${sessionId}/expenses${initial ? `/${initial.id}` : ""}`;
    const result = await sendJson<{ reset: SettlementState[] }>(url, initial ? "PATCH" : "POST", parsed.data);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onDone(result.data.reset, initial ? `Biaya "${parsed.data.name}" diubah.` : `Biaya "${parsed.data.name}" ditambahkan.`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-2xl border-2 border-ink-black bg-pure-white p-5" data-testid="expense-form">
      <h3 className="text-sub">{initial ? "Ubah biaya" : "Tambah biaya"}</h3>
      <Segmented legend="Jenis" name={`${id}-preset`} value={preset ?? "other"} options={PRESETS.map((p) => ({ value: p.value ?? "other", label: p.label }))} onChange={(v) => pickPreset(v === "other" ? null : (v as ExpensePreset))} />
      <Field label="Nama biaya" htmlFor={`${id}-name`}>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} required />
      </Field>
      <Field label="Nominal (Rp)" htmlFor={`${id}-amount`} hint={toInt(amount) > 0 ? formatRupiah(toInt(amount)) : undefined}>
        <input
          id={`${id}-amount`}
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(digits(e.target.value))}
          className={inputClass}
          required
        />
      </Field>
      <Field label="Ditalangi oleh" htmlFor={`${id}-payer`}>
        <select id={`${id}-payer`} value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={inputClass}>
          {payers.map((m) => (
            <option key={m} value={m}>
              {nameOf(names, m)}
            </option>
          ))}
        </select>
      </Field>
      <Segmented legend="Cara bagi" name={`${id}-split`} value={split} options={SPLIT_OPTIONS} onChange={setSplit} />

      {split === "all" && <p className="text-small">Dibagi rata ke {participants.length} peserta hadir dan ikut berubah bila peserta berubah.</p>}
      {split !== "all" && (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-small font-medium">
            {split === "equal" ? "Dibagi ke" : split === "custom" ? "Nominal tiap orang (Rp)" : "Bobot tiap orang (mis. menit main; kosong = tidak ikut)"}
          </legend>
          <ul className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black">
            {participants.map((m) => (
              <li key={m} className="flex min-h-12 items-center gap-3 px-4">
                {split === "equal" ? (
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={members.has(m)}
                      onChange={(e) => {
                        const next = new Set(members);
                        if (e.target.checked) next.add(m);
                        else next.delete(m);
                        setMembers(next);
                      }}
                      className="size-6 shrink-0 accent-ink-black"
                    />
                    <span className="min-w-0 flex-1 truncate text-ui">{nameOf(names, m)}</span>
                  </label>
                ) : (
                  <>
                    <label htmlFor={`${id}-${split}-${m}`} className="block min-w-0 flex-1 truncate text-ui">
                      {nameOf(names, m)}
                    </label>
                    <input
                      id={`${id}-${split}-${m}`}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`${split === "custom" ? "Nominal" : "Bobot"} ${nameOf(names, m)}`}
                      value={(split === "custom" ? custom : weights)[m] ?? ""}
                      onChange={(e) => {
                        const set = split === "custom" ? setCustom : setWeights;
                        set((prev) => ({ ...prev, [m]: digits(e.target.value) }));
                      }}
                      className="my-1 h-11 w-28 min-w-0 shrink-0 rounded-lg border-2 border-ink-black bg-pure-white px-3 text-right text-ui tabular-nums"
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
          {split === "custom" && (
            <p className="text-small" aria-live="polite">
              Terisi {formatRupiah(customTotal)} dari {formatRupiah(toInt(amount))}
              {customTotal !== toInt(amount) && ` · ${customTotal < toInt(amount) ? "kurang" : "lebih"} ${formatRupiah(Math.abs(toInt(amount) - customTotal))}`}
            </p>
          )}
        </fieldset>
      )}

      {preview && split !== "custom" && (
        <div className="flex flex-col gap-1 text-small" data-testid="share-preview">
          <p className="font-medium">Bagian tiap orang</p>
          <ul className="flex flex-col gap-1">
            {[...preview]
              .filter(([, v]) => v > 0)
              .map(([m, v]) => (
                <li key={m} className="flex justify-between gap-3 tabular-nums">
                  <span>{nameOf(names, m)}</span>
                  <span>{formatRupiah(v)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan biaya"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending} className="min-h-13">
          Batal
        </Button>
      </div>
    </form>
  );
}
