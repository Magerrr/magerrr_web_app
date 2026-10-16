// Teks tagihan siap tempel ke WhatsApp (PRD P7). Tanpa emoji; uang integer rupiah.
import { formatDateId, formatRupiah } from "@/lib/format";

export interface BillTextInput {
  groupName: string;
  startsAt: Date;
  venue: string | null;
  total: number;
  participants: number;
  /** iuran flat per orang (§5.7); null = bagi rata */
  flatFee?: number | null;
  /** nama sudah diselesaikan; urut seperti di layar */
  transfers: { from: string; to: string; amount: number; paid: boolean }[];
  payTo: { name: string; infos: { kind: "bank" | "ewallet" | "qris"; label: string; accountNo: string | null; accountName: string | null }[] }[];
  url: string;
}

export function billText(b: BillTextInput): string {
  const lines = [
    `Tagihan mabar ${b.groupName}`,
    `${formatDateId(b.startsAt)}${b.venue ? ` · ${b.venue}` : ""}`,
    b.flatFee ? `Iuran flat ${formatRupiah(b.flatFee)}/orang · ${b.participants} orang` : `Total ${formatRupiah(b.total)} · ${b.participants} orang`,
  ];
  const receivers = [...new Set(b.transfers.map((t) => t.to))];
  for (const to of receivers) {
    lines.push("", `Transfer ke ${to}:`);
    for (const t of b.transfers.filter((x) => x.to === to)) {
      lines.push(`- ${t.from} ${formatRupiah(t.amount)}${t.paid ? " (lunas)" : ""}`);
    }
  }
  if (receivers.length === 0) lines.push("", "Tidak ada yang perlu transfer.");
  for (const p of b.payTo.filter((x) => x.infos.length > 0)) {
    lines.push("", `Rekening ${p.name}:`);
    for (const i of p.infos) {
      if (i.kind === "qris") lines.push(`- ${i.label}: lihat gambar di tautan`);
      else lines.push(`- ${i.label} ${i.accountNo ?? ""}${i.accountName ? ` a.n. ${i.accountName}` : ""}`);
    }
  }
  lines.push("", "Rincian & tandai sudah bayar:", b.url);
  return lines.join("\n");
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
