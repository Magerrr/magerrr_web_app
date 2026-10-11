"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Notice, Segmented, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { bracketSize, roundName } from "@/lib/core/bracket";
import { fixtureCount, roundCount } from "@/lib/core/roundrobin";
import { formatProblem, snakeGroups, type GroupSetup, type TournamentFormat } from "@/lib/core/tournament";

type Pair = [string, string];
type Format = "doubles" | "singles";
type Pairing = "auto" | "manual";

const pairUp = (ids: string[]): Pair[] => Array.from({ length: Math.floor(ids.length / 2) }, (_, i) => [ids[2 * i], ids[2 * i + 1]]);

/** Ringkasan format untuk jumlah peserta yang sah: ukuran bagan, jumlah match, grup. */
function preview(system: TournamentFormat, n: number, groups: GroupSetup, unit: string): string {
  if (system === "round_robin") return `${n} ${unit} · ${fixtureCount(n)} match · ${roundCount(n)} ronde`;
  if (system === "groups_knockout") {
    const sizes = Array.from({ length: groups.count }, (_, g) => snakeGroups(n, groups.count).filter((x) => x === g).length);
    const size = groups.count * groups.advance;
    const matches = sizes.reduce((sum, k) => sum + fixtureCount(k), 0);
    return `${n} ${unit} · ${groups.count} grup (${sizes.join(", ")}) · ${matches} match fase grup · ${size} lolos ke ${roundName(1, Math.log2(size)).toLowerCase()}`;
  }
  const size = bracketSize(n);
  return `${n} ${unit} · bagan ${size} · ${Math.log2(size)} babak${size > n ? ` · ${size - n} lolos otomatis (bye) ke babak 2` : ""}`;
}

/** Buat turnamen dari peserta hadir: sistem gugur, grup + gugur, atau round robin; ganda (otomatis / manual) atau tunggal. */
export function TournamentForm({ url, players, defaultName }: { url: string; players: { id: string; name: string }[]; defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [format, setFormat] = useState<Format>("doubles");
  const [pairing, setPairing] = useState<Pairing>("auto");
  const [seeding, setSeeding] = useState<"rating" | "random">("rating");
  const [system, setSystem] = useState<TournamentFormat>("knockout");
  const [groups, setGroups] = useState<GroupSetup>({ count: 2, advance: 2 });
  const [selected, setSelected] = useState(players.map((p) => p.id));
  const [pairs, setPairs] = useState<Pair[]>(() => pairUp(players.map((p) => p.id)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const manual = format === "doubles" && pairing === "manual";

  const entryCount = format === "singles" ? selected.length : manual ? pairs.length : selected.length / 2;
  const paired = new Set(pairs.flat());
  const problem =
    !manual && format === "doubles" && selected.length % 2 !== 0
      ? "Jumlah pemain ganda harus genap."
      : manual && paired.size !== pairs.length * 2
        ? "Satu pemain hanya boleh ada di satu pasangan."
        : formatProblem(system, entryCount, groups);

  function toggle(id: string, on: boolean) {
    const next = on ? players.map((p) => p.id).filter((p) => p === id || selected.includes(p)) : selected.filter((p) => p !== id);
    setSelected(next);
    setPairs(pairUp(next));
  }

  async function submit() {
    setPending(true);
    setError(null);
    const entries =
      format === "singles" ? { mode: "singles", memberIds: selected } : manual ? { mode: "pairs", pairs } : { mode: "pairs_auto", memberIds: selected };
    const result = await sendJson(url, "POST", { name, seeding, format: system, groups: system === "groups_knockout" ? groups : null, entries });
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  const pairSelect = (pi: number, side: 0 | 1) => (
    <select
      aria-label={`Pasangan ${pi + 1} pemain ${side + 1}`}
      value={pairs[pi][side]}
      onChange={(e) => setPairs((ps) => ps.map((p, i) => (i === pi ? ((side === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]) as Pair) : p)))}
      className="h-11 min-w-0 flex-1 rounded-lg border-2 border-ink-black bg-pure-white px-2 text-ui"
    >
      {selected.map((id) => (
        <option key={id} value={id}>
          {nameOf(id)}
        </option>
      ))}
    </select>
  );

  return (
    <Card className="flex flex-col gap-5" data-testid="tournament-form">
      <h2 className="text-sub">Buat turnamen</h2>
      <Field label="Nama turnamen" htmlFor="tournament-name">
        <input id="tournament-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} />
      </Field>
      <Segmented
        legend="Format turnamen"
        name="system"
        value={system}
        onChange={setSystem}
        options={[
          { value: "knockout", label: "Sistem gugur" },
          { value: "groups_knockout", label: "Grup + gugur" },
          { value: "round_robin", label: "Round robin" },
        ]}
      />
      {system === "groups_knockout" && (
        <>
          <Segmented
            legend="Jumlah grup"
            name="group-count"
            value={groups.count}
            onChange={(count) => setGroups({ ...groups, count })}
            options={[2, 4, 8].map((n) => ({ value: n as GroupSetup["count"], label: `${n} grup` }))}
          />
          <Segmented
            legend="Lolos per grup"
            name="advance"
            value={groups.advance}
            onChange={(advance) => setGroups({ ...groups, advance })}
            options={[
              { value: 1, label: "Juara grup" },
              { value: 2, label: "Juara & runner-up" },
            ]}
          />
        </>
      )}
      <Segmented
        legend="Jenis main"
        name="format"
        value={format}
        onChange={setFormat}
        options={[
          { value: "doubles", label: "Ganda" },
          { value: "singles", label: "Tunggal" },
        ]}
      />
      {format === "doubles" && (
        <Segmented
          legend="Pasangan"
          name="pairing"
          value={pairing}
          onChange={(v) => {
            setPairing(v);
            setPairs(pairUp(selected));
          }}
          options={[
            { value: "auto", label: "Otomatis (seimbang)" },
            { value: "manual", label: "Atur sendiri" },
          ]}
        />
      )}

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-small font-medium">Peserta ({selected.length} dari {players.length} yang hadir)</legend>
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li key={p.id}>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink-black bg-pure-white px-4 text-ui has-checked:bg-ink-black has-checked:text-cream-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink-black">
                <input type="checkbox" className="sr-only" checked={selected.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
                {p.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {manual && (
        <div className="flex flex-col gap-2" data-testid="tournament-pairs">
          <p className="text-small font-medium">Pasangan</p>
          {pairs.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              {pairSelect(i, 0)}
              {pairSelect(i, 1)}
              <Button variant="secondary" className="w-11 px-0" aria-label={`Hapus pasangan ${i + 1}`} onClick={() => setPairs(pairs.filter((_, j) => j !== i))}>
                ×
              </Button>
            </div>
          ))}
          {selected.filter((id) => !paired.has(id)).length >= 2 && (
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => {
                const free = selected.filter((id) => !paired.has(id));
                setPairs([...pairs, [free[0], free[1]]]);
              }}
            >
              Tambah pasangan
            </Button>
          )}
        </div>
      )}

      <Segmented
        legend="Unggulan (seed)"
        name="seeding"
        value={seeding}
        onChange={setSeeding}
        options={[
          { value: "rating", label: "Dari rating" },
          { value: "random", label: "Acak" },
        ]}
      />
      <p className="text-small" data-testid="tournament-preview">
        {problem ?? preview(system, entryCount, groups, format === "doubles" ? "pasangan" : "pemain")}
      </p>
      <p className="text-caption">
        {system === "knockout" &&
          `Sistem gugur: kalah sekali langsung keluar. ${seeding === "rating" ? "Unggulan teratas (grade / win rate) baru bisa bertemu di babak akhir." : "Posisi di bagan diacak."}`}
        {system === "groups_knockout" &&
          `Grup + gugur: tiap grup main round robin, lalu ${groups.advance === 2 ? "juara & runner-up" : "juara"} grup lanjut ke sistem gugur. ${seeding === "rating" ? "Unggulan disebar ke grup berbeda." : "Isi grup diacak."}`}
        {system === "round_robin" && "Round robin: semua peserta saling bertemu sekali. Peringkat: jumlah menang, lalu adu langsung, selisih gim, selisih poin."}{" "}
        Peserta tidak bisa diubah setelah turnamen dibuat.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Button size="lg" variant="accent" onClick={submit} disabled={pending || problem !== null || name.trim() === ""}>
        Buat turnamen
      </Button>
    </Card>
  );
}
