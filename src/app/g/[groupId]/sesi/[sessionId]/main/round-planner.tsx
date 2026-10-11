"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice, Segmented } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { MatchKind } from "@/lib/core/types";
import type { Proposal } from "@/lib/db/play";
import type { Names } from "./types";

/** Posisi pemain di usulan: slot tim di lapangan, atau urutan di daftar tunggu. */
type Slot = { court: number; side: "A" | "B"; index: number } | { court: null; index: number };

const sameSlot = (x: Slot, y: Slot) =>
  x.court === y.court && x.index === y.index && (x.court === null || (y.court !== null && x.side === y.side));

function read(p: Proposal, s: Slot): string {
  return s.court === null ? p.waiting[s.index] : p.courts[s.court][s.side][s.index];
}

function write(p: Proposal, s: Slot, id: string): Proposal {
  if (s.court === null) return { ...p, waiting: p.waiting.map((w, i) => (i === s.index ? id : w)) };
  const court = s.court;
  return {
    ...p,
    courts: p.courts.map((c, i) => (i === court ? { ...c, [s.side]: c[s.side].map((m, j) => (j === s.index ? id : m)) } : c)),
  };
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

export function RoundPlanner({
  groupId,
  sessionId,
  rotation,
  fixed = false,
  rotationStarted,
  emptyCourts,
  availableCount,
  names,
}: {
  groupId: string;
  sessionId: string;
  rotation: boolean;
  /** mode fix_pasangan: selalu ganda, pasangan tidak bisa ditukar per pemain */
  fixed?: boolean;
  rotationStarted: boolean;
  emptyCourts: number;
  availableCount: number;
  names: Names;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<MatchKind>(fixed || availableCount >= 4 ? "doubles" : "singles");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const base = `/api/groups/${groupId}/sessions/${sessionId}`;

  async function plan(nextKind: MatchKind = kind) {
    setPending(true);
    setError(null);
    setSelected(null);
    const result = await sendJson<Proposal>(`${base}/plan`, "POST", { kind: nextKind, seed: randomSeed() });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setProposal(result.data);
  }

  async function start() {
    if (!proposal) return;
    setPending(true);
    setError(null);
    const result = await sendJson(`${base}/matches/start`, "POST", {
      matches: proposal.courts.map(({ courtNo, kind: k, A, B }) => ({ courtNo, kind: k, A, B })),
      seed: proposal.seed,
      queue: rotation ? proposal.waiting : null,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setProposal(null);
    router.refresh();
  }

  function tap(slot: Slot) {
    if (!proposal) return;
    if (!selected) return setSelected(slot);
    if (!sameSlot(selected, slot)) {
      const a = read(proposal, selected);
      const b = read(proposal, slot);
      setProposal(write(write(proposal, selected, b), slot, a));
    }
    setSelected(null);
  }

  const chip = (slot: Slot, id: string, label?: string) => {
    const on = selected !== null && sameSlot(selected, slot);
    if (fixed) {
      return (
        <span key={`${slot.court}-${"side" in slot ? slot.side : "w"}-${slot.index}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink-black bg-pure-white px-4 text-ui">
          {label && <span className="text-caption">{label}</span>}
          {names[id] ?? "?"}
        </span>
      );
    }
    return (
      <button
        key={`${slot.court}-${"side" in slot ? slot.side : "w"}-${slot.index}`}
        type="button"
        onClick={() => tap(slot)}
        aria-pressed={on}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-ink-black px-4 text-ui ${
          on ? "bg-ink-black text-cream-paper" : "bg-pure-white text-ink-black"
        }`}
      >
        {label && <span className="text-caption">{label}</span>}
        {names[id] ?? "?"}
      </button>
    );
  };

  const startLabel = rotation ? (rotationStarted ? "Isi lapangan kosong" : "Mulai rotasi") : fixed ? "Atur ronde" : "Kocok ronde";

  return (
    <section aria-labelledby="ronde" className="flex flex-col gap-4 rounded-2xl border border-dashed border-ink-black bg-pure-white p-4">
      <div>
        <h2 id="ronde" className="text-sub">
          {emptyCourts} lapangan kosong
        </h2>
        <p className="mt-1 text-small">
          {rotation
            ? "Pemain diambil dari antrian. Tap dua nama untuk menukar posisi."
            : fixed
              ? "Pasangan tetap; yang paling sedikit main didahulukan, lawan yang jarang bertemu, tim seimbang."
              : "Paling sedikit main didahulukan, pasangan jarang bertemu, tim seimbang. Tap dua nama untuk menukar."}
        </p>
      </div>
      {!fixed && (
        <Segmented
          legend="Jenis match"
          name="kind"
          value={kind}
          options={[
            { value: "doubles", label: "Ganda" },
            { value: "singles", label: "Tunggal" },
          ]}
          onChange={(k) => {
            setKind(k);
            if (proposal) void plan(k);
          }}
        />
      )}

      {!proposal ? (
        <Button size="lg" onClick={() => plan()} disabled={pending}>
          {startLabel}
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          {proposal.courts.length === 0 && (
            <Notice tone="error">
              {proposal.hint === "bisa tunggal" ? "Pemain kurang untuk ganda. Pilih Tunggal." : "Pemain yang menunggu belum cukup."}
            </Notice>
          )}
          {proposal.courts.map((c, ci) => (
            <div key={c.courtNo} className="flex flex-col gap-2" data-testid={`proposal-court-${c.courtNo}`}>
              <p className="text-small font-medium">Lapangan {c.courtNo}</p>
              <div className="flex flex-wrap items-center gap-2">
                {c.A.map((id, i) => chip({ court: ci, side: "A", index: i }, id))}
                <span className="px-1 text-small">vs</span>
                {c.B.map((id, i) => chip({ court: ci, side: "B", index: i }, id))}
              </div>
            </div>
          ))}
          {proposal.waiting.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-small font-medium">{rotation ? "Antrian" : "Istirahat"}</p>
              <div className="flex flex-wrap gap-2">{proposal.waiting.map((id, i) => chip({ court: null, index: i }, id, `${i + 1}`))}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={start} disabled={pending || proposal.courts.length === 0}>
              Mulai main
            </Button>
            {!rotation && (
              <Button variant="secondary" onClick={() => plan()} disabled={pending}>
                Acak ulang
              </Button>
            )}
            <Button variant="secondary" onClick={() => setProposal(null)} disabled={pending}>
              Batal
            </Button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
