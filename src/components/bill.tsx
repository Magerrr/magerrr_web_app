// Tampilan tagihan patungan, dipakai halaman admin/anggota dan halaman tagihan publik.
import Image from "next/image";
import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import type { BillProgress, PersonBill, SettlementState } from "@/lib/core/split";
import { formatRupiah } from "@/lib/format";

type Names = Record<string, string>;
const nameOf = (names: Names, id: string) => names[id] ?? "?";

const RING = 2 * Math.PI * 42;

/** Cincin x/y lunas + terkumpul vs total (desain SplitBill). */
export function BillProgressCard({ progress }: { progress: BillProgress }) {
  const ratio = progress.debtors === 0 ? 0 : progress.paidDebtors / progress.debtors;
  return (
    <section
      aria-label="Status patungan"
      className="flex items-center gap-5 rounded-2xl border border-ink-black bg-ink-black p-5 text-cream-paper"
      data-testid="bill-progress"
    >
      <svg width="88" height="88" viewBox="0 0 104 104" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="52" cy="52" r="42" className="stroke-pure-ink" strokeWidth="14" />
        {ratio > 0 && (
          <circle
            cx="52"
            cy="52"
            r="42"
            className="stroke-fresh-grass"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(ratio * RING).toFixed(1)} ${RING.toFixed(1)}`}
            transform="rotate(-90 52 52)"
          />
        )}
        <text x="52" y="54" textAnchor="middle" className="fill-cream-paper" fontSize="24" fontWeight="500">
          {progress.paidDebtors}/{progress.debtors}
        </text>
        <text x="52" y="72" textAnchor="middle" className="fill-cream-paper" fontSize="12" fontWeight="500">
          lunas
        </text>
      </svg>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="sr-only">
          {progress.paidDebtors} dari {progress.debtors} orang sudah lunas.
        </p>
        <p className="text-small">Terkumpul</p>
        <p className="text-title" data-testid="collected">
          {formatRupiah(progress.collected)}
        </p>
        <p className="text-small">
          dari {formatRupiah(progress.total)}
          {progress.total > progress.collected && ` · kurang ${formatRupiah(progress.total - progress.collected)}`}
        </p>
        {progress.awaiting > 0 && <p className="text-small">{progress.awaiting} menunggu konfirmasi</p>}
      </div>
    </section>
  );
}

export function PaymentBadge({ settlement }: { settlement: SettlementState }) {
  if (settlement.status === "paid") return <Badge tone="accent">Lunas</Badge>;
  if (settlement.selfReported) return <Badge tone="outline">Menunggu konfirmasi</Badge>;
  return <Badge tone="muted">Belum bayar</Badge>;
}

/** Daftar "siapa bayar ke siapa" (PRD P4). `actions` = tombol per baris (opsional). */
export function TransferList({
  settlements,
  names,
  me,
  actions,
}: {
  settlements: (SettlementState & { id: string })[];
  names: Names;
  me?: string | null;
  actions?: (settlement: SettlementState & { id: string }) => ReactNode;
}) {
  if (settlements.length === 0) {
    return (
      <Card>
        <p className="text-ui">Tidak ada yang perlu transfer.</p>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2" data-testid="transfers">
      {settlements.map((s) => {
        const mine = me != null && s.from === me;
        return (
          <li
            key={s.id}
            className={
              "flex flex-col gap-3 rounded-2xl px-4 py-3 " +
              (mine ? "border-1 border-ink-black bg-fresh-grass" : "border border-ink-black bg-pure-white")
            }
            data-testid="transfer-row"
            data-from={s.from}
            data-to={s.to}
          >
            <div className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-ui">
                  {nameOf(names, s.from)}
                  {mine && " (kamu)"}
                </span>
                <span className="truncate text-small">ke {nameOf(names, s.to)}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-lead tabular-nums" data-testid="transfer-amount">
                  {formatRupiah(s.amount)}
                </span>
                <PaymentBadge settlement={s} />
              </span>
            </div>
            {actions?.(s)}
          </li>
        );
      })}
    </ul>
  );
}

export interface PaymentInfoView {
  id: string;
  kind: "bank" | "ewallet" | "qris";
  label: string;
  accountNo: string | null;
  accountName: string | null;
}

const KIND_LABEL = { bank: "Bank", ewallet: "E-wallet", qris: "QRIS" } as const;

/** Info pembayaran penerima transfer (PRD P6). */
export function PaymentInfoList({ infos, qrSrc }: { infos: PaymentInfoView[]; qrSrc: (id: string) => string }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="payment-infos">
      {infos.map((i) => (
        <li key={i.id} className="flex flex-col gap-1 rounded-lg border border-ink-black bg-cream-paper px-4 py-3">
          <span className="text-caption">{KIND_LABEL[i.kind]}</span>
          <span className="text-ui">{i.label}</span>
          {i.accountNo && (
            <span className="text-lead tabular-nums select-all" data-testid="account-no">
              {i.accountNo}
            </span>
          )}
          {i.accountName && <span className="text-small">a.n. {i.accountName}</span>}
          {i.kind === "qris" && (
            <Image
              src={qrSrc(i.id)}
              alt={`Kode QRIS ${i.label}`}
              width={240}
              height={240}
              unoptimized
              className="mt-2 h-auto w-full max-w-60 rounded-lg border border-ink-black bg-pure-white"
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Rincian per orang: bagian, yang ditalangi (di bawah nama), dan transfer setelah pembulatan. */
export function PeopleTable({ people, names, me }: { people: PersonBill[]; names: Names; me?: string | null }) {
  const sorted = [...people].sort((x, y) => nameOf(names, x.memberId).localeCompare(nameOf(names, y.memberId), "id"));
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-black bg-pure-white">
      <table className="w-full table-fixed border-collapse text-small tabular-nums" data-testid="people">
        <caption className="sr-only">Rincian patungan per orang</caption>
        <thead className="border-b border-ink-black">
          <tr>
            <th scope="col" className="py-2 pl-4 text-left text-caption font-medium">
              Nama
            </th>
            <th scope="col" className="w-22 px-1 text-right text-caption font-medium">
              Bagian
            </th>
            <th scope="col" className="w-30 pr-4 pl-1 text-right text-caption font-medium">
              Transfer
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.memberId}
              className={p.memberId === me ? "bg-fresh-grass" : "border-t border-hairline-mist first:border-t-0"}
              data-testid="person-row"
              data-member={p.memberId}
            >
              <th scope="row" className="py-3 pl-4 text-left font-medium">
                <span className="block truncate">{nameOf(names, p.memberId)}</span>
                {p.paid > 0 && <span className="block text-caption">menalangi {formatRupiah(p.paid)}</span>}
              </th>
              <td className="px-1 text-right" data-testid="person-share">
                {formatRupiah(p.share)}
              </td>
              <td className="pr-4 pl-1 text-right" data-testid="person-transfer">
                {p.transfer > 0 ? `bayar ${formatRupiah(p.transfer)}` : p.transfer < 0 ? `terima ${formatRupiah(-p.transfer)}` : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
