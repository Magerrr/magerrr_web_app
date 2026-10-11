"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { Names } from "./types";

type Pair = [string, string];

/** Pasangan tetap sesi (mode fix_pasangan, PRD SC10c): otomatis seimbang atau diatur manual. */
export function PairsEditor({ url, pairs, present, names, editable }: { url: string; pairs: Pair[]; present: string[]; names: Names; editable: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Pair[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const name = (id: string) => names[id] ?? "?";
  const paired = new Set((draft ?? pairs).flat());
  const unpaired = present.filter((id) => !paired.has(id));

  async function save(body: { auto: true } | { pairs: Pair[] }) {
    setPending(true);
    setError(null);
    const result = await sendJson(url, "PUT", body);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setDraft(null);
    router.refresh();
  }

  const select = (pi: number, side: 0 | 1, value: string, label: string) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => setDraft((d) => (d ?? pairs).map((p, i) => (i === pi ? ((side === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]) as Pair) : p)))}
      className="h-11 min-w-0 flex-1 rounded-lg border-2 border-ink-black bg-pure-white px-2 text-ui"
    >
      {present.map((id) => (
        <option key={id} value={id}>
          {name(id)}
        </option>
      ))}
    </select>
  );

  return (
    <Card className="flex flex-col gap-3" data-testid="fixed-pairs">
      <h2 className="text-lead">Pasangan tetap</h2>
      {draft ? (
        <>
          <ul className="flex flex-col gap-2">
            {draft.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                {select(i, 0, p[0], `Pasangan ${i + 1} pemain 1`)}
                {select(i, 1, p[1], `Pasangan ${i + 1} pemain 2`)}
                <Button variant="secondary" className="w-11 px-0" aria-label={`Hapus pasangan ${i + 1}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                  ×
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {unpaired.length >= 2 && (
              <Button variant="secondary" onClick={() => setDraft([...draft, [unpaired[0], unpaired[1]]])}>
                Tambah pasangan
              </Button>
            )}
            <Button onClick={() => save({ pairs: draft })} disabled={pending}>
              Simpan pasangan
            </Button>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={pending}>
              Batal
            </Button>
          </div>
        </>
      ) : (
        <>
          {pairs.length === 0 ? (
            <p className="text-ui">Belum ada pasangan. {editable ? "Pasangkan otomatis (seimbang menurut grade / win rate) atau atur sendiri." : ""}</p>
          ) : (
            <ol className="flex flex-col gap-1 text-ui" data-testid="pair-list">
              {pairs.map((p, i) => (
                <li key={p.join()} className="flex gap-2">
                  <span className="w-6 tabular-nums">{i + 1}</span>
                  {name(p[0])} &amp; {name(p[1])}
                </li>
              ))}
            </ol>
          )}
          {unpaired.length > 0 && <p className="text-small">Tanpa pasangan: {unpaired.map(name).join(", ")}</p>}
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save({ auto: true })} disabled={pending}>
                Pasangkan otomatis
              </Button>
              <Button variant="secondary" onClick={() => setDraft(pairs.length > 0 ? pairs : [])} disabled={pending}>
                Atur manual
              </Button>
            </div>
          )}
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
