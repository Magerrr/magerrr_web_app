"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttendeePicker, type PickerMember } from "@/components/attendee-picker";
import { CostEstimate } from "@/components/cost-estimate";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { SessionStatus } from "@/lib/core/session";
import type { SettlementState } from "@/lib/core/split";

export function StatusActions({
  groupId,
  sessionId,
  status,
  recapHref,
}: {
  groupId: string;
  sessionId: string;
  status: SessionStatus;
  /** tujuan setelah sesi ditutup (R1: recap otomatis) */
  recapHref: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  if (status === "finished") return null;

  async function change(to: "running" | "finished") {
    if (to === "finished" && !window.confirm("Tutup sesi? Peserta dan detail sesi tidak bisa diubah lagi.")) return;
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/sessions/${sessionId}/status`, "POST", { status: to });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast(to === "finished" ? "Sesi ditutup." : "Sesi dimulai.");
    if (to === "finished") router.push(recapHref);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {status === "planned" ? (
        <Button size="lg" onClick={() => change("running")} loading={pending}>
          Mulai sesi
        </Button>
      ) : (
        <Button size="lg" variant="secondary" onClick={() => change("finished")} loading={pending}>
          Tutup sesi
        </Button>
      )}
    </div>
  );
}

export function AttendanceEditor({
  groupId,
  sessionId,
  members: initialMembers,
  presentIds,
  costs,
}: {
  groupId: string;
  sessionId: string;
  members: PickerMember[];
  presentIds: string[];
  costs: { items: { label: string; amount: number; paidBy: string }[]; hostId: string; roundTo: number; flatFee: number | null } | null;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [selected, setSelected] = useState(new Set(presentIds));
  const [saved, setSaved] = useState(new Set(presentIds));
  const [pending, setPending] = useState(false);
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));

  async function save() {
    setPending(true);
    const result = await sendJson<{ reset: SettlementState[] }>(`/api/groups/${groupId}/sessions/${sessionId}/attendees`, "PUT", {
      memberIds: [...selected],
    });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    setSaved(new Set(selected));
    const reset = result.data.reset;
    const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? "?";
    if (reset.length > 0) {
      toast.error(`Peserta disimpan. Status bayar direset karena tagihan berubah: ${reset.map((r) => `${name(r.from)} ke ${name(r.to)}`).join(", ")}.`);
    } else toast("Peserta disimpan.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <AttendeePicker
        groupId={groupId}
        members={members}
        selected={selected}
        onChange={setSelected}
        onMemberAdded={(m) => setMembers([...members, m])}
      />
      <Button size="lg" onClick={save} disabled={!dirty || pending}>
        {pending ? "Menyimpan…" : dirty ? "Simpan peserta" : "Peserta tersimpan"}
      </Button>
      {costs && <CostEstimate items={costs.items} participants={[...selected]} hostId={costs.hostId} roundTo={costs.roundTo} flatFee={costs.flatFee} />}
    </div>
  );
}

/** Sembunyikan sesi dari pencarian publik walau grupnya publik (#15). Hanya admin; server memvalidasi ulang. */
export function ListedToggle({ groupId, sessionId, listed: initial }: { groupId: string; sessionId: string; listed: boolean }) {
  const router = useRouter();
  const [listed, setListed] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !listed;
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/sessions/${sessionId}/listed`, "PUT", { listed: next });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    setListed(next);
    toast(next ? "Sesi tampil di pencarian publik." : "Sesi disembunyikan dari pencarian publik.");
    router.refresh();
  }

  return (
    <section aria-labelledby="tampil-publik" className="flex flex-col gap-3 rounded-2xl border-1 bg-pure-white p-5" data-testid="listed-toggle">
      <h2 id="tampil-publik" className="text-sub">
        Tampil di pencarian publik
      </h2>
      <p className="text-small">
        {listed
          ? "Sesi ini bisa ditemukan orang lain di Jelajahi. Sembunyikan bila hanya untuk anggota."
          : "Sesi ini disembunyikan dari Jelajahi. Anggota tetap bisa membukanya lewat tautan grup."}
      </p>
      <Button variant="secondary" onClick={toggle} loading={pending} aria-pressed={!listed}>
        {listed ? "Sembunyikan dari pencarian" : "Tampilkan di pencarian"}
      </Button>
    </section>
  );
}

/** Hapus sesi (MAGERRR-17): dua langkah — tombol lalu konfirmasi berisi apa saja yang ikut terhapus. */
export function DeleteSession({ groupId, sessionId, label, hasCosts }: { groupId: string; sessionId: string; label: string; hasCosts: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/sessions/${sessionId}`, "DELETE");
    if (!result.ok) {
      setPending(false);
      return toast.error(result.error);
    }
    toast(`Sesi ${label} dihapus.`);
    router.push(`/g/${groupId}`);
    router.refresh();
  }

  return (
    <section aria-labelledby="hapus-sesi" className="flex flex-col gap-3 rounded-2xl border-1 border-coral-pop bg-pure-white p-5" data-testid="delete-session">
      <h2 id="hapus-sesi" className="text-sub">
        Hapus sesi
      </h2>
      {confirming ? (
        <>
          <p className="text-small">
            Hapus sesi {label}? Skor match dan klasemen dari sesi ini{hasCosts ? ", biaya, serta tagihan patungan (termasuk status lunas)" : ""} ikut
            terhapus permanen. Foto momen tetap ada. Tidak bisa dibatalkan.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={remove} loading={pending} className="border-1 border-coral-pop">
              {pending ? "Menghapus…" : "Ya, hapus sesi"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Batal
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-small">Untuk sesi yang batal atau salah dibuat. Semua isinya ikut terhapus.</p>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Hapus sesi ini
          </Button>
        </>
      )}
    </section>
  );
}
