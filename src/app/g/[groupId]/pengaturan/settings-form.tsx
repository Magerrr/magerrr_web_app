"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NumberField, RulesPicker, draftFromRules, rulesFromDraft, toInt } from "@/components/rules-picker";
import { Button, Card, Field, Notice, Segmented, inputBase, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { PLAY_MODE_OPTIONS, toOfferedMode } from "../sesi/status";
import type { GroupSettings } from "@/lib/db/groups";

export function SettingsForm({ group }: { group: GroupSettings }) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(group.emoji ?? "");
  const [rulesDraft, setRulesDraft] = useState(draftFromRules(group.rules));
  const [matchGames, setMatchGames] = useState(group.matchGames);
  const [winPoints, setWinPoints] = useState(String(group.scoring.winPoints));
  const [lossPoints, setLossPoints] = useState(String(group.scoring.lossPoints));
  const [bonus, setBonus] = useState(group.scoring.lossBonus != null);
  const [maxMargin, setMaxMargin] = useState(String(group.scoring.lossBonus?.maxMargin ?? 2));
  const [bonusPoints, setBonusPoints] = useState(String(group.scoring.lossBonus?.points ?? 1));
  const [minMatches, setMinMatches] = useState(String(group.scoring.minMatches));
  const [roundTo, setRoundTo] = useState(group.roundTo);
  const [playMode, setPlayMode] = useState(toOfferedMode(group.defaultPlayMode));
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setStatus(null);
    const result = await sendJson(`/api/groups/${group.id}`, "PATCH", {
      name,
      emoji,
      rules: rulesFromDraft(rulesDraft),
      matchGames,
      scoring: {
        winPoints: toInt(winPoints),
        lossPoints: toInt(lossPoints),
        lossBonus: bonus ? { maxMargin: toInt(maxMargin), points: toInt(bonusPoints) } : null,
        minMatches: toInt(minMatches),
      },
      roundTo,
      defaultPlayMode: playMode,
    });
    setPending(false);
    setStatus(result.ok ? { tone: "info", text: "Pengaturan disimpan." } : { tone: "error", text: result.error });
    if (result.ok) router.refresh();
  }

  return (
    <form action={save} className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <h2 className="text-sub">Grup</h2>
        <Field label="Nama grup" htmlFor="name">
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className={inputClass} />
        </Field>
        <Field label="Ikon (opsional)" htmlFor="emoji" hint="Satu emoji sebagai ikon grup.">
          <input id="emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={16} className={`${inputBase} w-24`} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-sub">Aturan skor</h2>
        <RulesPicker draft={rulesDraft} onChange={setRulesDraft} matchGames={matchGames} onMatchGamesChange={setMatchGames} />
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-sub">Poin klasemen</h2>
        <div className="flex flex-wrap gap-4">
          <NumberField id="win-points" label="Menang" value={winPoints} onChange={setWinPoints} />
          <NumberField id="loss-points" label="Kalah" value={lossPoints} onChange={setLossPoints} />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-ui">
          <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} className="size-6 accent-ink-black" />
          Bonus untuk kalah tipis
        </label>
        {bonus && (
          <div className="flex flex-wrap gap-4">
            <NumberField id="max-margin" label="Selisih maksimal" value={maxMargin} onChange={setMaxMargin} hint="Total poin rally dalam match." />
            <NumberField id="bonus-points" label="Bonus poin" value={bonusPoints} onChange={setBonusPoints} />
          </div>
        )}
        <NumberField id="min-matches" label="Minimal main agar masuk peringkat" value={minMatches} onChange={setMinMatches} hint="0 = semua pemain langsung masuk peringkat." />
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-sub">Sesi & patungan</h2>
        <Segmented
          legend="Mode main default"
          name="play-mode"
          value={playMode}
          options={PLAY_MODE_OPTIONS}
          onChange={setPlayMode}
        />
        <Segmented
          legend="Pembulatan patungan"
          name="round-to"
          value={roundTo}
          options={[
            { value: 1, label: "Tanpa pembulatan" },
            { value: 500, label: "Rp500" },
            { value: 1000, label: "Rp1.000" },
          ]}
          onChange={setRoundTo}
        />
        <p className="text-small">Tagihan tiap orang dibulatkan ke atas; kelebihannya dikreditkan ke host.</p>
      </Card>

      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Menyimpan…" : "Simpan pengaturan"}
      </Button>
    </form>
  );
}
