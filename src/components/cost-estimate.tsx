import { debtRange, splitBill, type Expense } from "@/lib/core/split";
import { formatRupiah } from "@/lib/format";

/**
 * Perkiraan patungan per orang dari biaya + peserta hadir, memakai fungsi inti
 * (splitBill → applyRounding), bukan rumus ulang.
 */
export function CostEstimate({
  items,
  participants,
  hostId,
  roundTo,
  flatFee = null,
}: {
  /** biaya dibagi rata ke peserta hadir; `paidBy` = yang menalangi */
  items: { label: string; amount: number; paidBy: string }[];
  participants: string[];
  hostId: string;
  roundTo: number;
  /** iuran flat per peserta (MAGERRR-14); null = bagi rata */
  flatFee?: number | null;
}) {
  const lines = items.filter((l) => l.amount > 0);
  const expenses: Expense[] = lines.map((l, i) => ({ id: String(i), amount: l.amount, paidBy: l.paidBy, mode: "equal" }));
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const range =
    (expenses.length > 0 || flatFee !== null) && participants.length > 0
      ? debtRange(splitBill({ participants, expenses, hostId, roundTo, flatFee }).rounded)
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-ink-black p-5 text-cream-paper" data-testid="cost-estimate">
      <h3 className="text-sub">Perkiraan patungan</h3>
      <dl className="flex flex-col gap-2 text-ui">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3">
            <dt>{l.label}</dt>
            <dd>{formatRupiah(l.amount)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-cream-paper/30 pt-2">
          <dt>{flatFee !== null ? `Iuran flat · ${participants.length} pemain` : `Patungan ÷ ${participants.length} pemain`}</dt>
          <dd className="text-lead" data-testid="per-person">
            {range
              ? range.min === range.max
                ? `${formatRupiah(range.max)}/org`
                : `${formatRupiah(range.min)}–${formatRupiah(range.max)}/org`
              : "–"}
          </dd>
        </div>
      </dl>
      <p className="text-caption">
        {flatFee !== null
          ? `Tiap pemain bayar ${formatRupiah(flatFee)} ke pengelola sesi, yang menanggung biaya${total > 0 ? ` ${formatRupiah(total)}` : ""} dan selisihnya.`
          : total === 0
            ? "Isi biaya untuk melihat perkiraan."
            : participants.length === 0
              ? "Tandai peserta hadir untuk melihat perkiraan."
              : `Total ${formatRupiah(total)}. Tagihan tiap orang dibulatkan ke atas${roundTo > 1 ? ` ke kelipatan ${formatRupiah(roundTo)}` : ""}; kelebihannya untuk host.`}
      </p>
    </div>
  );
}
