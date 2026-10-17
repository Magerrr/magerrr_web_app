"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDragSwap } from "@/components/drag-swap";
import { Icon } from "@/components/icons";
import { Button, Notice, Segmented } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { MatchKind } from "@/lib/core/types";
import type { Proposal } from "@/lib/db/play";
import { moveLineup, sameSlot, swapSlots, type Slot } from "@/lib/round-edit";
import type { Names } from "./types";

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

/** Kunci seret: `p:<indeks lapangan|w>:<sisi>:<indeks>` untuk pemain, `c:<nomor lapangan>` untuk susunan satu lapangan. */
const slotKey = (s: Slot) => (s.court === null ? `p:w:-:${s.index}` : `p:${s.court}:${s.side}:${s.index}`);

function parseSlot(key: string): Slot | null {
  const [kind, court, side, index] = key.split(":");
  if (kind !== "p") return null;
  if (court === "w") return { court: null, index: Number(index) };
  return { court: Number(court), side: side as "A" | "B", index: Number(index) };
}

const courtOf = (key: string) => (key.startsWith("c:") ? Number(key.slice(2)) : null);

/**
 * Susun ronde untuk lapangan kosong (MAGERRR-10): pilih lapangan yang diisi sebelum kocok, lalu ubah susunan sebelum mulai:
 * seret nama ke slot lain untuk menukar pemain, seret pegangan ⠿ kartu lapangan ke lapangan lain untuk pindah/tukar
 * lapangan. Alternatif tanpa seret: tap dua nama untuk menukar, dan pilihan "Lapangan" di tiap kartu.
 */
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
  /** nomor lapangan yang sedang kosong, urut */
  emptyCourts: number[];
  availableCount: number;
  names: Names;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<MatchKind>(fixed || availableCount >= 4 ? "doubles" : "singles");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  /** lapangan kosong yang tidak ikut diisi ronde ini; default semua diisi */
  const [skipped, setSkipped] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"plan" | "start" | null>(null);
  const base = `/api/groups/${groupId}/sessions/${sessionId}`;
  const chosen = emptyCourts.filter((c) => !skipped.includes(c));

  const drag = useDragSwap((from, to) => {
    if (!proposal) return;
    setSelected(null);
    const fromCourt = courtOf(from);
    if (fromCourt !== null) {
      // Kartu lapangan dilepas di atas kartu lapangan lain, atau di atas salah satu nama di dalamnya.
      const target = courtOf(to) ?? proposal.courts[parseSlot(to)?.court ?? -1]?.courtNo;
      if (target !== undefined) setProposal(moveLineup(proposal, fromCourt, target, emptyCourts));
      return;
    }
    const x = parseSlot(from);
    const y = parseSlot(to);
    if (!fixed && x && y) setProposal(swapSlots(proposal, x, y));
  });

  async function plan(nextKind: MatchKind = kind) {
    setPending("plan");
    setError(null);
    setSelected(null);
    const result = await sendJson<Proposal>(`${base}/plan`, "POST", {
      kind: nextKind,
      seed: randomSeed(),
      ...(skipped.length > 0 ? { courts: chosen } : {}),
    });
    setPending(null);
    if (!result.ok) return setError(result.error);
    setProposal(result.data);
  }

  async function start() {
    if (!proposal) return;
    setPending("start");
    setError(null);
    const result = await sendJson(`${base}/matches/start`, "POST", {
      matches: proposal.courts.map(({ courtNo, kind: k, A, B }) => ({ courtNo, kind: k, A, B })),
      seed: proposal.seed,
      queue: rotation ? proposal.waiting : null,
    });
    setPending(null);
    if (!result.ok) return setError(result.error);
    setProposal(null);
    router.refresh();
  }

  function tap(slot: Slot) {
    if (!proposal) return;
    if (!selected) return setSelected(slot);
    setProposal(swapSlots(proposal, selected, slot));
    setSelected(null);
  }

  function toggleCourt(courtNo: number) {
    setSkipped((s) => (s.includes(courtNo) ? s.filter((c) => c !== courtNo) : [...s, courtNo]));
  }

  const chip = (slot: Slot, id: string, label?: string) => {
    const key = slotKey(slot);
    if (fixed) {
      return (
        <span key={key} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink-black bg-pure-white px-4 text-ui">
          {label && <span className="text-caption">{label}</span>}
          {names[id] ?? "?"}
        </span>
      );
    }
    const on = selected !== null && sameSlot(selected, slot);
    const over = drag.isOver(key);
    return (
      <button
        key={key}
        type="button"
        onClick={() => tap(slot)}
        aria-pressed={on}
        {...drag.handle(key)}
        {...drag.drop(key)}
        style={drag.dragStyle(key)}
        className={`inline-flex min-h-11 cursor-grab touch-none items-center gap-2 rounded-full border border-ink-black px-4 text-ui transition-colors select-none data-dragging:cursor-grabbing data-dragging:shadow-[0_4px_0_0_var(--color-ink-black)] ${
          on || over ? "bg-ink-black text-cream-paper" : "bg-pure-white text-ink-black hover:bg-fresh-grass/40"
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
          {emptyCourts.length} lapangan kosong
        </h2>
        <p className="mt-1 text-small">
          {rotation
            ? "Pemain diambil dari antrian. Seret atau tap dua nama untuk menukar posisi."
            : fixed
              ? "Pasangan tetap; yang paling sedikit main didahulukan, lawan yang jarang bertemu, tim seimbang."
              : "Paling sedikit main didahulukan, pasangan jarang bertemu, tim seimbang. Seret atau tap dua nama untuk menukar."}
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
        <>
          {emptyCourts.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-small font-medium">Lapangan yang diisi</legend>
              <div className="flex flex-wrap gap-2">
                {emptyCourts.map((c) => (
                  <label
                    key={c}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink-black bg-pure-white px-4 text-ui has-checked:bg-fresh-grass"
                  >
                    <input type="checkbox" checked={!skipped.includes(c)} onChange={() => toggleCourt(c)} className="size-5 accent-ink-black" />
                    Lapangan {c}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Button size="lg" onClick={() => plan()} loading={pending === "plan"} disabled={chosen.length === 0}>
            {startLabel}
          </Button>
          {chosen.length === 0 && <p className="text-small">Pilih minimal satu lapangan.</p>}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {proposal.courts.length === 0 && (
            <Notice tone="error">
              {proposal.hint === "bisa tunggal" ? "Pemain kurang untuk ganda. Pilih Tunggal." : "Pemain yang menunggu belum cukup."}
            </Notice>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {emptyCourts.map((courtNo) => {
              const ci = proposal.courts.findIndex((c) => c.courtNo === courtNo);
              const lineup = ci >= 0 ? proposal.courts[ci] : null;
              const key = `c:${courtNo}`;
              const over = drag.isOver(key);
              return (
                <div
                  key={courtNo}
                  {...drag.drop(key)}
                  style={drag.dragStyle(key)}
                  data-testid={lineup ? `proposal-court-${courtNo}` : `free-court-${courtNo}`}
                  className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
                    over ? "border-ink-black bg-fresh-grass/40" : lineup ? "border-ink-black bg-cream-paper" : "border-dashed border-ink-black bg-pure-white"
                  } ${drag.dragging === key ? "shadow-[0_4px_0_0_var(--color-ink-black)]" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {lineup && emptyCourts.length > 1 && (
                      // Pegangan seret khusus pointer; alternatif keyboard/pembaca layar = pilihan lapangan di sebelahnya.
                      <span
                        aria-hidden="true"
                        title="Seret untuk pindah lapangan"
                        {...drag.handle(key)}
                        className="-ml-1 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg hover:bg-sandstone data-dragging:cursor-grabbing"
                      >
                        <Icon name="grip" size={20} />
                      </span>
                    )}
                    <p className="min-w-0 flex-1 text-small font-medium">Lapangan {courtNo}</p>
                    {lineup && emptyCourts.length > 1 && (
                      <select
                        aria-label={`Pindahkan susunan lapangan ${courtNo} ke`}
                        value={courtNo}
                        onChange={(e) => setProposal(moveLineup(proposal, courtNo, Number(e.target.value), emptyCourts))}
                        className="h-11 rounded-lg border-1 border-ink-black bg-pure-white px-2 text-small"
                      >
                        {emptyCourts.map((c) => (
                          <option key={c} value={c}>
                            Lapangan {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {lineup ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {lineup.A.map((id, i) => chip({ court: ci, side: "A", index: i }, id))}
                      <span className="px-1 text-small">vs</span>
                      {lineup.B.map((id, i) => chip({ court: ci, side: "B", index: i }, id))}
                    </div>
                  ) : (
                    <p className="text-small">Tidak dipakai ronde ini. Seret susunan ke sini untuk pindah lapangan.</p>
                  )}
                </div>
              );
            })}
          </div>
          {proposal.waiting.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-small font-medium">{rotation ? "Antrian" : "Istirahat"}</p>
              <div className="flex flex-wrap gap-2">{proposal.waiting.map((id, i) => chip({ court: null, index: i }, id, `${i + 1}`))}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={start} loading={pending === "start"} disabled={pending !== null || proposal.courts.length === 0}>
              Mulai main
            </Button>
            {!rotation && (
              <Button variant="secondary" onClick={() => plan()} loading={pending === "plan"} disabled={pending !== null}>
                Acak ulang
              </Button>
            )}
            <Button variant="secondary" onClick={() => setProposal(null)} disabled={pending !== null}>
              Batal
            </Button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
