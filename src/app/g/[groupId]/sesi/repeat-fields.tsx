"use client";

import { Field, Segmented, inputClass } from "@/components/ui";
import { MAX_AHEAD, repeatLabel, type Repeat } from "@/lib/core/recurrence";

/** Isian pengulangan sesi (S5). `frequency: "none"` = tidak berulang. */
export interface RepeatDraft {
  frequency: "none" | "weekly" | "monthly";
  monthlyBy: "date" | "weekday";
  ahead: number;
}

export const NO_REPEAT: RepeatDraft = { frequency: "none", monthlyBy: "weekday", ahead: 1 };

/** Draf → isi API (`repeat`), atau null bila tidak berulang. */
export function repeatBody(draft: RepeatDraft) {
  if (draft.frequency === "none") return null;
  return { frequency: draft.frequency, monthlyBy: draft.frequency === "monthly" ? draft.monthlyBy : null, ahead: draft.ahead };
}

/** Label pengulangan, atau null selama tanggal belum valid (isian tanggal masih diketik). */
function safeLabel(repeat: Repeat, anchor: string): string | null {
  try {
    return repeatLabel(repeat, anchor);
  } catch {
    return null;
  }
}

/**
 * Pilihan Ulangi (Tidak / Mingguan / Bulanan), cara ulang bulanan, dan jumlah sesi yang disiapkan.
 * `anchor` = tanggal sesi pertama seri, dasar label "tanggal 15" / "Sabtu ke-3".
 */
export function RepeatFields({
  id,
  anchor,
  value,
  onChange,
  allowNone = true,
}: {
  id: string;
  anchor: string;
  value: RepeatDraft;
  onChange: (value: RepeatDraft) => void;
  allowNone?: boolean;
}) {
  const label = (monthlyBy: "date" | "weekday") =>
    safeLabel({ frequency: "monthly", monthlyBy }, anchor)?.replace("Tiap bulan, ", "Tiap ") ?? (monthlyBy === "date" ? "Tanggal sama" : "Hari sama di minggu ke-N");
  const summary = safeLabel(value.frequency === "monthly" ? { frequency: "monthly", monthlyBy: value.monthlyBy } : { frequency: "weekly" }, anchor);
  const frequencies = [
    ...(allowNone ? [{ value: "none" as const, label: "Tidak" }] : []),
    { value: "weekly" as const, label: "Mingguan" },
    { value: "monthly" as const, label: "Bulanan" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Segmented legend="Ulangi" name={`${id}-frequency`} value={value.frequency} options={frequencies} onChange={(frequency) => onChange({ ...value, frequency })} />
      {value.frequency === "monthly" && (
        <Segmented
          legend="Ulangi bulanan pada"
          name={`${id}-monthly-by`}
          value={value.monthlyBy}
          options={[
            { value: "weekday", label: label("weekday") },
            { value: "date", label: label("date") },
          ]}
          onChange={(monthlyBy) => onChange({ ...value, monthlyBy })}
        />
      )}
      {value.frequency !== "none" && (
        <>
          <Field label="Jumlah sesi yang disiapkan" htmlFor={`${id}-ahead`} hint="Total sesi mendatang yang selalu tersedia di daftar, termasuk sesi ini.">
            <select id={`${id}-ahead`} value={value.ahead} onChange={(e) => onChange({ ...value, ahead: Number(e.target.value) })} className={inputClass}>
              {Array.from({ length: MAX_AHEAD }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} sesi
                </option>
              ))}
            </select>
          </Field>
          <p className="text-small">
            {summary && `${summary}. `}
            Sesi berikutnya dibuat otomatis berstatus Rencana dengan detail dan peserta dari sesi terakhir seri; RSVP langsung terbuka.
          </p>
        </>
      )}
    </div>
  );
}
