"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttendeePicker, type PickerMember } from "@/components/attendee-picker";
import { CostEstimate } from "@/components/cost-estimate";
import { Button, Notice } from "@/components/ui";
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (status === "finished") return null;

  async function change(to: "running" | "finished") {
    if (to === "finished" && !window.confirm("Tutup sesi? Peserta dan detail sesi tidak bisa diubah lagi.")) return;
    setPending(true);
    setError(null);
    const result = await sendJson(`/api/groups/${groupId}/sessions/${sessionId}/status`, "POST", { status: to });
    setPending(false);
    if (!result.ok) return setError(result.error);
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
      {error && <Notice tone="error">{error}</Notice>}
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
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));

  async function save() {
    setPending(true);
    setStatus(null);
    const result = await sendJson<{ reset: SettlementState[] }>(`/api/groups/${groupId}/sessions/${sessionId}/attendees`, "PUT", {
      memberIds: [...selected],
    });
    setPending(false);
    if (!result.ok) return setStatus({ tone: "error", text: result.error });
    setSaved(new Set(selected));
    const reset = result.data.reset;
    const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? "?";
    setStatus(
      reset.length > 0
        ? {
            tone: "error",
            text: `Peserta disimpan. Status bayar direset karena tagihan berubah: ${reset.map((r) => `${name(r.from)} ke ${name(r.to)}`).join(", ")}.`,
          }
        : { tone: "info", text: "Peserta disimpan." },
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <AttendeePicker
        groupId={groupId}
        members={members}
        selected={selected}
        onChange={(next) => {
          setSelected(next);
          setStatus(null);
        }}
        onMemberAdded={(m) => setMembers([...members, m])}
      />
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <Button size="lg" onClick={save} disabled={!dirty || pending}>
        {pending ? "Menyimpan…" : dirty ? "Simpan peserta" : "Peserta tersimpan"}
      </Button>
      {costs && <CostEstimate items={costs.items} participants={[...selected]} hostId={costs.hostId} roundTo={costs.roundTo} flatFee={costs.flatFee} />}
    </div>
  );
}
