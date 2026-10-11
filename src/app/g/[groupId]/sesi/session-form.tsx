"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttendeePicker, type PickerMember } from "@/components/attendee-picker";
import { CostEstimate } from "@/components/cost-estimate";
import { NumberField, RulesPicker, draftFromRules, rulesFromDraft, toInt } from "@/components/rules-picker";
import { Button, Card, Field, Notice, Segmented, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { GameRules } from "@/lib/core/rules";
import { courtCost } from "@/lib/core/split";
import { formatDurationId } from "@/lib/format";
import { PLAY_MODE_OPTIONS, type OfferedPlayMode } from "./status";

export interface SessionDefaults {
  date: string;
  time: string;
  durationMin: number;
  venue: string | null;
  courtCount: number;
  playMode: OfferedPlayMode;
  rules: GameRules;
  matchGames: 1 | 3 | 5;
  note: string | null;
}

const DURATIONS = [60, 90, 120, 150, 180, 240, 300, 360];
const MAX_COURTS = 12;

type CreateExtras = {
  members: PickerMember[];
  initialSelected: string[];
  selfMemberId: string;
  roundTo: number;
  /** isian awal biaya (duplikat sesi, S5) */
  initialCosts?: { courtPerHour: number | null; shuttle: number | null };
};

export function SessionForm({
  groupId,
  sessionId,
  defaults,
  create,
}: {
  groupId: string;
  /** ada = mode ubah */
  sessionId?: string;
  defaults: SessionDefaults;
  /** hanya mode buat: peserta & biaya */
  create?: CreateExtras;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [durationMin, setDurationMin] = useState(defaults.durationMin);
  const [venue, setVenue] = useState(defaults.venue ?? "");
  const [courts, setCourts] = useState(defaults.courtCount);
  const [playMode, setPlayMode] = useState(defaults.playMode);
  const [rulesDraft, setRulesDraft] = useState(draftFromRules(defaults.rules));
  const [matchGames, setMatchGames] = useState(defaults.matchGames);
  const [note, setNote] = useState(defaults.note ?? "");
  const [members, setMembers] = useState(create?.members ?? []);
  const [selected, setSelected] = useState(new Set(create?.initialSelected ?? []));
  const [courtPerHour, setCourtPerHour] = useState(String(create?.initialCosts?.courtPerHour ?? ""));
  const [shuttle, setShuttle] = useState(String(create?.initialCosts?.shuttle ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const perHour = toInt(courtPerHour);
  const courtTotal = Number.isInteger(perHour) && perHour > 0 ? courtCost({ perHour, courts, durationMin }) : 0;
  const shuttleTotal = Number.isInteger(toInt(shuttle)) ? Math.max(0, toInt(shuttle)) : 0;
  const durations = DURATIONS.includes(durationMin) ? DURATIONS : [...DURATIONS, durationMin].sort((a, b) => a - b);

  async function submit() {
    setPending(true);
    setError(null);
    const details = {
      date,
      time,
      durationMin,
      venue,
      courtCount: courts,
      playMode,
      rules: rulesFromDraft(rulesDraft),
      matchGames,
      note,
    };
    const result = sessionId
      ? await sendJson<{ id: string }>(`/api/groups/${groupId}/sessions/${sessionId}`, "PATCH", details)
      : await sendJson<{ id: string }>(`/api/groups/${groupId}/sessions`, "POST", {
          ...details,
          attendeeIds: [...selected],
          costs: {
            courtPerHour: courtPerHour.trim() ? perHour : null,
            shuttle: shuttle.trim() ? toInt(shuttle) : null,
          },
        });
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/g/${groupId}/sesi/${result.data.id}`);
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <h2 className="text-sub">Waktu & tempat</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal" htmlFor="date">
            <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Jam mulai" htmlFor="time">
            <input id="time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Durasi sewa" htmlFor="duration">
          <select id="duration" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className={inputClass}>
            {durations.map((m) => (
              <option key={m} value={m}>
                {formatDurationId(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tempat" htmlFor="venue" hint="Nama GOR atau lokasi.">
          <input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} autoComplete="off" className={inputClass} />
        </Field>
        <div className="flex items-center gap-3">
          <p id="courts-label" className="flex-1 text-small font-medium">
            Jumlah lapangan
          </p>
          <Button variant="secondary" aria-label="Kurangi lapangan" onClick={() => setCourts(Math.max(1, courts - 1))} disabled={courts <= 1} className="w-11 px-0">
            −
          </Button>
          <output aria-labelledby="courts-label" className="w-8 text-center text-sub">
            {courts}
          </output>
          <Button variant="secondary" aria-label="Tambah lapangan" onClick={() => setCourts(Math.min(MAX_COURTS, courts + 1))} disabled={courts >= MAX_COURTS} className="w-11 px-0">
            +
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-sub">Cara main</h2>
        <Segmented
          legend="Mode main"
          name="play-mode"
          value={playMode}
          options={PLAY_MODE_OPTIONS}
          onChange={setPlayMode}
        />
        <RulesPicker draft={rulesDraft} onChange={setRulesDraft} matchGames={matchGames} onMatchGamesChange={setMatchGames} />
      </Card>

      {create && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-sub">Peserta hadir</h2>
          <AttendeePicker
            groupId={groupId}
            members={members}
            selected={selected}
            onChange={setSelected}
            onMemberAdded={(m) => setMembers([...members, m])}
          />
        </Card>
      )}

      {create && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-sub">Biaya (opsional)</h2>
            <p className="mt-1 text-small">Dicatat sebagai biaya yang kamu talangi. Bisa diubah nanti di Patungan.</p>
          </div>
          <NumberField id="court-per-hour" label="Sewa per lapangan per jam (Rp)" value={courtPerHour} onChange={setCourtPerHour} className="w-full" />
          <NumberField id="shuttle" label="Biaya kok (Rp)" value={shuttle} onChange={setShuttle} className="w-full" hint="Misalnya harga satu slop." />
          <CostEstimate
            items={[
              { label: `Lapangan ${courts} × ${formatDurationId(durationMin)}`, amount: courtTotal, paidBy: create.selfMemberId },
              { label: "Kok", amount: shuttleTotal, paidBy: create.selfMemberId },
            ]}
            participants={[...selected]}
            hostId={create.selfMemberId}
            roundTo={create.roundTo}
          />
        </Card>
      )}

      <Field label="Catatan (opsional)" htmlFor="note">
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="w-full rounded-lg border-2 border-ink-black bg-pure-white px-4 py-3 text-ui" />
      </Field>

      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Menyimpan…" : sessionId ? "Simpan perubahan" : "Simpan sesi"}
      </Button>
    </form>
  );
}
