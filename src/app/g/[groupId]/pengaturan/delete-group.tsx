"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

/** Hapus grup permanen: tombol aktif hanya setelah nama grup diketik ulang persis. */
export function DeleteGroup({ groupId, groupName }: { groupId: string; groupName: string }) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const matches = confirmName.trim() === groupName.trim();

  async function remove() {
    setPending(true);
    setError(null);
    const result = await sendJson(`/api/groups/${groupId}`, "DELETE", { confirmName: confirmName.trim() });
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4 border-1 border-coral-pop" aria-labelledby="hapus-grup">
      <div className="flex flex-col gap-1">
        <h2 id="hapus-grup" className="text-sub">
          Hapus grup
        </h2>
        <p className="text-small">
          Semua anggota, sesi, skor, klasemen, patungan, dan obrolan grup ini ikut terhapus permanen. Tidak bisa dibatalkan.
        </p>
      </div>
      <form action={remove} className="flex flex-col gap-4">
        <Field label={`Ketik "${groupName}" untuk konfirmasi`} htmlFor="confirm-name">
          <input
            id="confirm-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
            maxLength={60}
            className={inputClass}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="secondary" disabled={!matches} loading={pending}>
          {pending ? "Menghapus…" : "Hapus grup ini"}
        </Button>
      </form>
    </Card>
  );
}
