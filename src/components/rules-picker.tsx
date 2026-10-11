"use client";

import { Field, Segmented, inputBase } from "@/components/ui";
import { PRESETS, type GameRules } from "@/lib/core/rules";
import { describeRules } from "@/lib/format";

type PresetKey = keyof typeof PRESETS | "custom";

/** Isian aturan skor sebagai teks agar input angka bisa dikosongkan sementara. */
export interface RulesDraft {
  preset: PresetKey;
  target: string;
  deuce: boolean;
  cap: string;
}

const PRESET_OPTIONS: { value: PresetKey; label: string }[] = [
  { value: "bwf21", label: "21 poin (BWF)" },
  { value: "poin15", label: "15 poin" },
  { value: "poin11", label: "11 poin" },
  { value: "custom", label: "Kustom" },
];

const MATCH_GAME_OPTIONS = [
  { value: 1 as const, label: "1 game" },
  { value: 3 as const, label: "Best of 3" },
  { value: 5 as const, label: "Best of 5" },
];

export const toInt = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

export function draftFromRules(rules: GameRules): RulesDraft {
  const preset = (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).find((key) => {
    const p = PRESETS[key];
    return p.target === rules.target && p.deuce === rules.deuce && p.cap === rules.cap;
  });
  return { preset: preset ?? "custom", target: String(rules.target), deuce: rules.deuce, cap: String(rules.cap) };
}

export function rulesFromDraft(draft: RulesDraft): GameRules {
  if (draft.preset !== "custom") return { ...PRESETS[draft.preset] };
  const target = toInt(draft.target);
  return { target, deuce: draft.deuce, cap: draft.deuce ? toInt(draft.cap) : target };
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  className = "w-28",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} ${className}`}
      />
    </Field>
  );
}

export function RulesPicker({
  draft,
  onChange,
  matchGames,
  onMatchGamesChange,
}: {
  draft: RulesDraft;
  onChange: (draft: RulesDraft) => void;
  matchGames: 1 | 3 | 5;
  onMatchGamesChange: (games: 1 | 3 | 5) => void;
}) {
  const rules = rulesFromDraft(draft);
  return (
    <div className="flex flex-col gap-5">
      <Segmented legend="Poin per game" name="preset" value={draft.preset} options={PRESET_OPTIONS} onChange={(preset) => onChange({ ...draft, preset })} />
      {draft.preset === "custom" && (
        <div className="flex flex-col gap-4">
          <NumberField id="target" label="Target poin" value={draft.target} onChange={(target) => onChange({ ...draft, target })} hint="Minimal 5." />
          <label className="flex min-h-11 items-center gap-3 text-ui">
            <input
              type="checkbox"
              checked={draft.deuce}
              onChange={(e) => onChange({ ...draft, deuce: e.target.checked })}
              className="size-6 accent-ink-black"
            />
            Deuce: harus unggul 2 poin
          </label>
          {draft.deuce && (
            <NumberField
              id="cap"
              label="Batas maksimum"
              value={draft.cap}
              onChange={(cap) => onChange({ ...draft, cap })}
              hint="Game berhenti di angka ini walau belum unggul 2."
            />
          )}
        </div>
      )}
      {Number.isInteger(rules.target) && <p className="text-small">{describeRules(rules)}</p>}
      <Segmented legend="Jumlah game per match" name="match-games" value={matchGames} options={MATCH_GAME_OPTIONS} onChange={onMatchGamesChange} />
    </div>
  );
}
