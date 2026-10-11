"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Notice, Segmented, inputBase, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { checkGames, type GameRules } from "@/lib/core/rules";
import type { GameScore, MatchKind } from "@/lib/core/types";

export interface MatchFormInitial {
  matchId: string;
  kind: MatchKind;
  courtNo: number | null;
  A: string[];
  B: string[];
  games: GameScore[];
}

const SLOTS = { A: ["Pemain A1", "Pemain A2"], B: ["Pemain B1", "Pemain B2"] } as const;

/** Input skor akhir manual (SC11) dan edit hasil match (SC7). Validasi skor memakai fungsi inti. */
export function MatchForm({
  groupId,
  sessionId,
  players,
  courtCount,
  rules,
  gamesMax,
  initial,
}: {
  groupId: string;
  sessionId: string;
  players: { id: string; name: string }[];
  courtCount: number;
  rules: GameRules;
  gamesMax: 1 | 3 | 5;
  initial?: MatchFormInitial;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<MatchKind>(initial?.kind ?? "doubles");
  const [courtNo, setCourtNo] = useState(initial?.courtNo ? String(initial.courtNo) : "");
  const [teams, setTeams] = useState<{ A: string[]; B: string[] }>({
    A: [initial?.A[0] ?? "", initial?.A[1] ?? ""],
    B: [initial?.B[0] ?? "", initial?.B[1] ?? ""],
  });
  const [scores, setScores] = useState(
    Array.from({ length: gamesMax }, (_, i) => ({
      a: initial?.games[i] ? String(initial.games[i].a) : "",
      b: initial?.games[i] ? String(initial.games[i].b) : "",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const size = kind === "doubles" ? 2 : 1;
  const games: GameScore[] = scores
    .filter((s) => s.a.trim() !== "" && s.b.trim() !== "")
    .map((s) => ({ a: Number(s.a), b: Number(s.b) }));
  let preview: string;
  try {
    const winner = checkGames(games, rules, { games: gamesMax }, { complete: true });
    const names = teams[winner!]
      .slice(0, size)
      .map((id) => players.find((p) => p.id === id)?.name)
      .filter(Boolean);
    preview = `Pemenang: ${names.length ? names.join(" / ") : `sisi ${winner}`}.`;
  } catch (e) {
    preview = games.length === 0 ? "Isi skor tiap game." : (e as Error).message;
  }

  async function submit() {
    setPending(true);
    setError(null);
    const body = {
      kind,
      courtNo: courtNo ? Number(courtNo) : null,
      A: teams.A.slice(0, size),
      B: teams.B.slice(0, size),
      games,
    };
    const base = `/api/groups/${groupId}/sessions/${sessionId}/matches`;
    const result = initial
      ? await sendJson(`${base}/${initial.matchId}`, "PATCH", body)
      : await sendJson(base, "POST", body);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/g/${groupId}/sesi/${sessionId}/main`);
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <Segmented
          legend="Jenis match"
          name="kind"
          value={kind}
          options={[
            { value: "doubles", label: "Ganda" },
            { value: "singles", label: "Tunggal" },
          ]}
          onChange={setKind}
        />
        <Field label="Lapangan (opsional)" htmlFor="court">
          <select id="court" value={courtNo} onChange={(e) => setCourtNo(e.target.value)} className={inputClass}>
            <option value="">Tidak dicatat</option>
            {Array.from({ length: courtCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Lapangan {n}
              </option>
            ))}
          </select>
        </Field>
        {/* Tablet+: Sisi A dan B berdampingan. */}
        <div className="flex flex-col gap-5 sm:grid sm:grid-cols-2 sm:gap-4">
          {(["A", "B"] as const).map((side) => (
            <fieldset key={side} className="flex min-w-0 flex-col gap-3">
              <legend className="mb-2 text-small font-medium">Sisi {side}</legend>
              {SLOTS[side].slice(0, size).map((label, i) => (
                <select
                  key={label}
                  aria-label={label}
                  required
                  value={teams[side][i]}
                  onChange={(e) => setTeams({ ...teams, [side]: teams[side].map((v, j) => (j === i ? e.target.value : v)) })}
                  className={inputClass}
                >
                  <option value="">Pilih pemain</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ))}
            </fieldset>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sub">Skor</h2>
        <div className="flex items-center gap-3 text-small" aria-hidden="true">
          <span className="w-16 shrink-0" />
          <span className="w-20 text-center">Sisi A</span>
          <span className="w-20 text-center">Sisi B</span>
        </div>
        {scores.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-16 shrink-0 whitespace-nowrap text-small">Game {i + 1}</span>
            {(["a", "b"] as const).map((key) => (
              <input
                key={key}
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                aria-label={`Game ${i + 1} sisi ${key.toUpperCase()}`}
                value={s[key]}
                onChange={(e) => setScores(scores.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))}
                className={`${inputBase} w-20 text-center`}
              />
            ))}
          </div>
        ))}
        <p className="text-small" aria-live="polite">
          {preview}
        </p>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Menyimpan…" : initial ? "Simpan perubahan" : "Simpan match"}
      </Button>
    </form>
  );
}
