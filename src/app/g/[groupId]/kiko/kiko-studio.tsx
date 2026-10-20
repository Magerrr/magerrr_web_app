"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KIKO_FUR_COLORS, KIKO_JERSEY_COLORS, Kiko } from "@/components/kiko";
import { toast } from "@/components/toast";
import { Button, Card } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { KIKO_ACC, KIKO_FUR, KIKO_HAT, KIKO_JERSEY, KIKO_UNLOCK, defaultOutfit, type KikoLevel, type KikoMood, type KikoOutfit, type OutfitPart } from "@/lib/core/mascot";

const PART_LABEL: Record<OutfitPart, string> = { fur: "Warna bulu", hat: "Topi", acc: "Aksesori", jersey: "Jersey" };
const OPTION_LABEL: { [P in OutfitPart]: Record<KikoOutfit[P], string> } = {
  fur: Object.fromEntries(KIKO_FUR.map((f) => [f, KIKO_FUR_COLORS[f].label])) as Record<KikoOutfit["fur"], string>,
  hat: { none: "Tanpa topi", band: "Ikat kepala", cap: "Topi", crown: "Mahkota" },
  acc: { none: "Tanpa", ball: "Kok", racket: "Raket", shades: "Kacamata" },
  jersey: { none: "Tanpa jersey", ...(Object.fromEntries(Object.entries(KIKO_JERSEY_COLORS).map(([k, v]) => [k, v.label])) as Record<Exclude<KikoOutfit["jersey"], "none">, string>) },
};
const OPTIONS: { [P in OutfitPart]: readonly KikoOutfit[P][] } = { fur: KIKO_FUR, hat: KIKO_HAT, acc: KIKO_ACC, jersey: KIKO_JERSEY };
const PARTS: OutfitPart[] = ["fur", "hat", "acc", "jersey"];

/** Panggung Kiko (ketuk untuk elus) + lemari kostum. Pilihan terkunci menampilkan level yang dibutuhkan. */
export function KikoStudio({
  groupId,
  level,
  mood,
  outfit,
  custom,
  greeting,
  levelName,
}: {
  groupId: string;
  level: KikoLevel;
  mood: KikoMood;
  outfit: KikoOutfit;
  custom: boolean;
  greeting: string;
  levelName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(outfit);
  const [pets, setPets] = useState(0);
  const [jumping, setJumping] = useState(false);
  const [pending, setPending] = useState<"save" | "auto" | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const lines = [greeting, "Purr… makasih! Aku makin semangat.", "Hehe, geli! Ayo cari partner ganda."];
  const changed = PARTS.some((p) => draft[p] !== outfit[p]);

  function pet() {
    setPets((n) => n + 1);
    setJumping(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJumping(false), 1400);
  }

  async function save(next: KikoOutfit | null) {
    setPending(next ? "save" : "auto");
    const result = await sendJson(`/api/groups/${groupId}/kiko`, "PUT", { outfit: next });
    setPending(null);
    if (!result.ok) return toast.error(result.error);
    if (next === null) setDraft(defaultOutfit(level));
    toast(next ? "Kostum Kiko disimpan." : "Kostum kembali otomatis sesuai level.");
    router.refresh();
  }

  return (
    <>
      <div className="relative flex h-80 items-end justify-center overflow-hidden rounded-2xl border border-ink-black bg-sandstone md:sticky md:top-6" data-testid="kiko-stage">
        <svg className="absolute inset-0 size-full" viewBox="0 0 350 320" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path d="M0 320l60-90h230l60 90z" fill="var(--color-fresh-grass)" />
          <path d="M175 230v90M30 285h290" stroke="var(--color-pure-white)" strokeOpacity="0.7" strokeWidth="3" />
        </svg>
        <p className="absolute top-4 right-4 left-4 max-w-64 rounded-2xl rounded-bl-sm border border-ink-black bg-pure-white px-3 py-2 text-small" aria-live="polite" data-testid="kiko-bubble">
          {lines[pets % lines.length]}
        </p>
        <button type="button" onClick={pet} className="relative mb-2 rounded-full">
          <span className="sr-only">Elus Kiko</span>
          <Kiko level={level} mood={mood} outfit={draft} size={220} jumping={jumping} label={`Kiko, Lv ${level} ${levelName}`} />
        </button>
      </div>

      <Card className="flex flex-col gap-4" data-testid="kiko-wardrobe">
        <div className="flex flex-col gap-1">
          <h2 className="text-lead">Kostum</h2>
          <p className="text-small">{custom ? "Kostum pilihanmu." : "Kostum otomatis: berganti sendiri tiap naik level."} Pilihan baru terbuka saat Kiko naik level.</p>
        </div>
        {PARTS.map((part) => (
          <fieldset key={part} className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 text-small font-medium">{PART_LABEL[part]}</legend>
            <div className="flex flex-wrap gap-2">
              {OPTIONS[part].map((value) => {
                const need = (KIKO_UNLOCK[part] as Record<string, KikoLevel>)[value];
                const locked = need > level;
                return (
                  <label
                    key={value}
                    className={
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-ui has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink-black " +
                      (locked ? "cursor-not-allowed border-sandstone bg-sandstone" : "cursor-pointer border-ink-black bg-pure-white has-checked:bg-ink-black has-checked:text-cream-paper")
                    }
                  >
                    <input
                      type="radio"
                      name={part}
                      className="sr-only"
                      disabled={locked}
                      checked={draft[part] === value}
                      onChange={() => setDraft((d) => ({ ...d, [part]: value }))}
                    />
                    {(OPTION_LABEL[part] as Record<string, string>)[value]}
                    {locked && <span className="text-caption">Lv {need}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(draft)} loading={pending === "save"} disabled={pending !== null || (!changed && custom)}>
            Simpan kostum
          </Button>
          {custom && (
            <Button variant="secondary" onClick={() => save(null)} loading={pending === "auto"} disabled={pending !== null}>
              Kostum otomatis
            </Button>
          )}
          {changed && (
            <Button variant="secondary" onClick={() => setDraft(outfit)} disabled={pending !== null}>
              Batal
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}
