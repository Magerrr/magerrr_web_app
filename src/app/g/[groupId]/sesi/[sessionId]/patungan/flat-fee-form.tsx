"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "@/components/toast";
import { Button, Card, Field, Segmented, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { SettlementState } from "@/lib/core/split";
import { formatRupiah } from "@/lib/format";

type Kind = "split" | "flat";

const OPTIONS: { value: Kind; label: string }[] = [
  { value: "split", label: "Bagi rata" },
  { value: "flat", label: "Iuran flat" },
];

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 8);

/**
 * Cara patungan sesi (MAGERRR-14, ALGORITHMS §5.7). Bagi rata = biaya dibagi ke peserta; iuran flat = tiap peserta
 * membayar nominal tetap ke pengelola, yang menanggung biaya dan selisihnya. Admin bisa mengganti; anggota hanya melihat.
 */
export function FlatFeeForm({
  url,
  flatFee,
  hostName,
  names,
  isAdmin,
}: {
  url: string;
  flatFee: number | null;
  hostName: string;
  names: Record<string, string>;
  isAdmin: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(flatFee === null ? "split" : "flat");
  const [fee, setFee] = useState(flatFee === null ? "" : String(flatFee));
  const [pending, setPending] = useState(false);

  const description =
    flatFee === null
      ? "Bagi rata: total biaya dibagi ke peserta sesuai cara bagi tiap biaya."
      : `Iuran flat ${formatRupiah(flatFee)} per orang, dibayar ke ${hostName}. Biaya sesi ditanggung ${hostName}, termasuk selisihnya.`;

  if (!isAdmin) {
    return (
      <Card className="flex flex-col gap-1" data-testid="split-kind">
        <h3 className="text-lead">Cara patungan</h3>
        <p className="text-small">{description}</p>
      </Card>
    );
  }

  const value = kind === "flat" ? Number(fee || 0) : null;
  const unchanged = value === flatFee;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (kind === "flat" && !value) return toast.error("Isi iuran per orang.");
    setPending(true);
    const result = await sendJson<{ reset: SettlementState[] }>(url, "PATCH", { flatFee: value });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    const reset = result.data.reset;
    if (reset.length > 0) {
      toast.error(
        `Cara patungan disimpan. Status bayar direset karena nominal transfer berubah: ${reset
          .map((r) => `${names[r.from] ?? "?"} ke ${names[r.to] ?? "?"} (${formatRupiah(r.amount)})`)
          .join(", ")}. Tandai ulang setelah dicek.`,
      );
    } else toast("Cara patungan disimpan.");
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4" data-testid="split-kind">
        <Segmented legend="Cara patungan" name={`${id}-kind`} value={kind} options={OPTIONS} onChange={setKind} />
        {kind === "flat" ? (
          <Field
            label="Iuran per orang (Rp)"
            htmlFor={`${id}-fee`}
            hint={`${fee ? `${formatRupiah(Number(fee))} · ` : ""}Dibayar ke ${hostName}, yang menanggung biaya sesi dan selisihnya.`}
          >
            <input
              id={`${id}-fee`}
              inputMode="numeric"
              autoComplete="off"
              value={fee}
              onChange={(e) => setFee(digits(e.target.value))}
              className={inputClass}
              required
            />
          </Field>
        ) : (
          <p className="text-small">Total biaya dibagi ke peserta sesuai cara bagi tiap biaya.</p>
        )}
        <Button type="submit" variant="secondary" loading={pending} disabled={pending || unchanged}>
          Simpan cara patungan
        </Button>
      </form>
    </Card>
  );
}
