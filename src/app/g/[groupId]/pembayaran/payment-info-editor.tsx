"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, Segmented, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { paymentInfoSchema } from "@/lib/validation";

export function DeletePaymentInfo({ groupId, id, label }: { groupId: string; id: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function remove() {
    if (!window.confirm(`Hapus ${label}?`)) return;
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/payment-infos/${id}`, "DELETE");
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast(`${label} dihapus.`);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={remove} loading={pending} className="self-start">
        Hapus {label}
      </Button>
    </div>
  );
}

type Kind = "bank" | "ewallet" | "qris";

export function AddPaymentInfo({ groupId }: { groupId: string }) {
  const id = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("bank");
  const [label, setLabel] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    let error: string | null = null;
    setPending(true);
    if (kind === "qris") {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setPending(false);
        return toast.error("Pilih gambar QRIS.");
      }
      const form = new FormData();
      form.set("label", label);
      form.set("file", file);
      try {
        const response = await fetch(`/api/groups/${groupId}/payment-infos/qris`, { method: "POST", body: form });
        if (!response.ok) error = (await response.json().catch(() => ({}))).error ?? "Gagal mengunggah. Coba lagi.";
      } catch {
        error = "Tidak ada koneksi. Periksa internet lalu coba lagi.";
      }
    } else {
      const parsed = paymentInfoSchema.safeParse({ kind, label, accountNo, accountName });
      if (!parsed.success) error = parsed.error.issues[0]?.message ?? "Data belum lengkap.";
      else {
        const result = await sendJson(`/api/groups/${groupId}/payment-infos`, "POST", parsed.data);
        if (!result.ok) error = result.error;
      }
    }
    setPending(false);
    if (error) return toast.error(error);
    setLabel("");
    setAccountNo("");
    setAccountName("");
    if (fileRef.current) fileRef.current.value = "";
    toast("Info pembayaran disimpan.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-2xl border border-ink-black bg-pure-white p-5">
      <h2 className="text-sub">Tambah info pembayaran</h2>
      <Segmented
        legend="Jenis"
        name={`${id}-kind`}
        value={kind}
        options={[
          { value: "bank", label: "Bank" },
          { value: "ewallet", label: "E-wallet" },
          { value: "qris", label: "QRIS" },
        ]}
        onChange={setKind}
      />
      <Field label={kind === "bank" ? "Nama bank" : kind === "ewallet" ? "Nama e-wallet" : "Label (opsional)"} htmlFor={`${id}-label`}>
        <input
          id={`${id}-label`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder={kind === "bank" ? "BCA" : kind === "ewallet" ? "GoPay" : "QRIS"}
          className={inputClass}
        />
      </Field>
      {kind === "qris" ? (
        <Field label="Gambar QRIS" htmlFor={`${id}-file`} hint="PNG, JPG, atau WebP, maksimal 2 MB.">
          <input id={`${id}-file`} ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="min-h-11 text-ui" />
        </Field>
      ) : (
        <>
          <Field label={kind === "bank" ? "Nomor rekening" : "Nomor HP / akun"} htmlFor={`${id}-no`}>
            <input id={`${id}-no`} value={accountNo} onChange={(e) => setAccountNo(e.target.value)} inputMode="numeric" maxLength={40} className={inputClass} />
          </Field>
          <Field label="Atas nama (opsional)" htmlFor={`${id}-name`}>
            <input id={`${id}-name`} value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={60} className={inputClass} />
          </Field>
        </>
      )}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
