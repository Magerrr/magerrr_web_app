"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice, buttonClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { SettlementState } from "@/lib/core/split";
import { trackShare } from "@/lib/analytics-client";
import { whatsappUrl } from "@/lib/bill-text";

function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  /** aksi yang sedang berjalan (untuk spinner di tombol yang diklik) */
  const [pending, setPending] = useState<string | null>(null);
  async function run(url: string, method: "POST" | "PATCH", body: { action?: string } = {}) {
    setPending(body.action ?? method);
    setError(null);
    const result = await sendJson(url, method, body);
    setPending(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }
  return { error, pending, run };
}

/** Admin: tandai lunas / batal lunas / tolak laporan "sudah bayar" (PRD P5). */
export function PaymentActions({ url, settlement }: { url: string; settlement: SettlementState }) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {settlement.status === "paid" ? (
          <Button variant="secondary" loading={pending === "unpaid"} disabled={pending !== null} onClick={() => run(url, "PATCH", { action: "unpaid" })}>
            Batal lunas
          </Button>
        ) : (
          <Button loading={pending === "paid"} disabled={pending !== null} onClick={() => run(url, "PATCH", { action: "paid" })}>
            {settlement.selfReported ? "Konfirmasi lunas" : "Tandai lunas"}
          </Button>
        )}
        {settlement.status !== "paid" && settlement.selfReported && (
          <Button variant="secondary" loading={pending === "reject"} disabled={pending !== null} onClick={() => run(url, "PATCH", { action: "reject" })}>
            Belum masuk
          </Button>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

/** Pemain: "Saya sudah bayar" → menunggu konfirmasi admin. */
export function SelfReportButton({ url }: { url: string }) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Button variant="accent" loading={pending !== null} onClick={() => run(url, "POST")}>
        Saya sudah bayar
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function RecomputeButton({ url }: { url: string }) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" loading={pending !== null} onClick={() => run(url, "POST")}>
        {pending !== null ? "Menghitung…" : "Hitung ulang tagihan"}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

/** Bagikan tagihan: WhatsApp (wa.me), salin teks, salin tautan (PRD P7). */
export function ShareBill({ text, url, token }: { text: string; url: string; token: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(value: string, label: string, channel: "copy_text" | "copy_link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      trackShare("bill_shared", token, channel);
    } catch {
      setCopied("Tidak bisa menyalin otomatis. Salin manual dari kotak di bawah.");
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <a
        href={whatsappUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare("bill_shared", token, "whatsapp")}
        className={buttonClass("accent", "lg")}
      >
        Bagikan ke WhatsApp
      </a>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => copy(text, "Teks tagihan disalin.", "copy_text")}>
          Salin teks
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => copy(url, "Tautan tagihan disalin.", "copy_link")}>
          Salin tautan
        </Button>
      </div>
      {copied && <Notice>{copied}</Notice>}
      <details className="text-small">
        <summary className="min-h-11 cursor-pointer content-center">Lihat teks tagihan</summary>
        <pre className="rounded-lg border border-ink-black bg-cream-paper p-3 font-sans text-small whitespace-pre-wrap" data-testid="bill-text">
          {text}
        </pre>
      </details>
    </div>
  );
}
