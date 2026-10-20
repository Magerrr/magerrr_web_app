"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NumberField, toInt } from "@/components/rules-picker";
import { toast } from "@/components/toast";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import type { SessionTemplate } from "@/lib/db/session-templates";
import { PLAY_MODE_OPTIONS, toOfferedMode } from "../sesi/status";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function describe(t: SessionTemplate): string {
  const parts = [`${DAYS[t.weekday]} ${t.startTime}–${t.endTime}`, t.venue ?? "Tempat belum diisi", `${t.courtCount} lapangan`];
  if (t.courtPerHour) parts.push(`sewa ${formatRupiah(t.courtPerHour)}/lapangan/jam`);
  if (t.shuttleCost) parts.push(`kok ${formatRupiah(t.shuttleCost)}`);
  return parts.join(" · ");
}

function TemplateForm({ groupId, template, defaultPlayMode, onDone }: { groupId: string; template?: SessionTemplate; defaultPlayMode: string; onDone: () => void }) {
  const router = useRouter();
  const [weekday, setWeekday] = useState(String(template?.weekday ?? 5));
  const [startTime, setStartTime] = useState(template?.startTime ?? "19:00");
  const [endTime, setEndTime] = useState(template?.endTime ?? "21:00");
  const [venue, setVenue] = useState(template?.venue ?? "");
  const [courtCount, setCourtCount] = useState(String(template?.courtCount ?? 1));
  const [playMode, setPlayMode] = useState(template?.playMode ?? toOfferedMode(defaultPlayMode));
  const [courtPerHour, setCourtPerHour] = useState(template?.courtPerHour ? String(template.courtPerHour) : "");
  const [shuttleCost, setShuttleCost] = useState(template?.shuttleCost ? String(template.shuttleCost) : "");
  const [leadDays, setLeadDays] = useState(String(template?.leadDays ?? 7));
  const [pending, setPending] = useState(false);
  const key = template?.id ?? "baru";

  async function save() {
    setPending(true);
    const result = await sendJson(
      template ? `/api/groups/${groupId}/session-templates/${template.id}` : `/api/groups/${groupId}/session-templates`,
      template ? "PATCH" : "POST",
      {
        weekday: Number(weekday),
        startTime,
        endTime,
        venue,
        courtCount: toInt(courtCount),
        playMode,
        courtPerHour: courtPerHour === "" ? null : toInt(courtPerHour),
        shuttleCost: shuttleCost === "" ? null : toInt(shuttleCost),
        leadDays: toInt(leadDays),
      },
    );
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast(template ? "Jadwal disimpan." : "Jadwal dibuat. Sesinya muncul otomatis menjelang harinya.");
    onDone();
    router.refresh();
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <Field label="Hari" htmlFor={`hari-${key}`}>
        <select id={`hari-${key}`} value={weekday} onChange={(e) => setWeekday(e.target.value)} className={inputClass}>
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jam mulai" htmlFor={`mulai-${key}`}>
          <input id={`mulai-${key}`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Jam selesai" htmlFor={`selesai-${key}`}>
          <input id={`selesai-${key}`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className={inputClass} />
        </Field>
      </div>
      <Field label="Tempat" htmlFor={`tempat-${key}`}>
        <input id={`tempat-${key}`} value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} className={inputClass} />
      </Field>
      <Field label="Mode main" htmlFor={`mode-${key}`}>
        <select id={`mode-${key}`} value={playMode} onChange={(e) => setPlayMode(e.target.value as typeof playMode)} className={inputClass}>
          {PLAY_MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap gap-3">
        <NumberField id={`lapangan-${key}`} label="Jumlah lapangan" value={courtCount} onChange={setCourtCount} />
        <NumberField id={`dibuat-${key}`} label="Dibuat berapa hari sebelum" value={leadDays} onChange={setLeadDays} hint="1–14 hari" />
      </div>
      <div className="flex flex-wrap gap-3">
        <NumberField id={`sewa-${key}`} label="Sewa per lapangan per jam (Rp)" value={courtPerHour} onChange={setCourtPerHour} className="w-44" />
        <NumberField id={`kok-${key}`} label="Biaya kok (Rp)" value={shuttleCost} onChange={setShuttleCost} className="w-44" />
      </div>
      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          {template ? "Simpan jadwal" : "Buat jadwal"}
        </Button>
        {template && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}

function TemplateRow({ groupId, template, defaultPlayMode }: { groupId: string; template: SessionTemplate; defaultPlayMode: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Terjadi kesalahan. Coba lagi.");
    toast(done);
    router.refresh();
  }
  const url = `/api/groups/${groupId}/session-templates/${template.id}`;

  if (editing) {
    return (
      <Card>
        <TemplateForm groupId={groupId} template={template} defaultPlayMode={defaultPlayMode} onDone={() => setEditing(false)} />
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3" data-testid="template-row">
      <p className="text-ui">{describe(template)}</p>
      <p className="text-small">{template.paused ? "Dijeda — tidak membuat sesi baru." : `Aktif — sesi dibuat ${template.leadDays} hari sebelumnya.`}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
          Ubah
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => run(() => sendJson(url, "PATCH", { paused: !template.paused }), template.paused ? "Jadwal dilanjutkan." : "Jadwal dijeda.")}
        >
          {template.paused ? "Lanjutkan" : "Jeda"}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (confirm("Hapus jadwal ini? Sesi yang sudah dibuat tidak ikut terhapus.")) void run(() => sendJson(url, "DELETE"), "Jadwal dihapus.");
          }}
        >
          Hapus
        </Button>
      </div>
    </Card>
  );
}

export function TemplateManager({ groupId, templates, defaultPlayMode }: { groupId: string; templates: SessionTemplate[]; defaultPlayMode: string }) {
  return (
    <div className="flex flex-col gap-5">
      {templates.length === 0 ? <p className="text-ui">Belum ada jadwal mingguan.</p> : templates.map((t) => <TemplateRow key={t.id} groupId={groupId} template={t} defaultPlayMode={defaultPlayMode} />)}
      <Card className="flex flex-col gap-4">
        <h2 className="text-sub">Tambah jadwal</h2>
        <TemplateForm groupId={groupId} defaultPlayMode={defaultPlayMode} onDone={() => undefined} />
      </Card>
    </div>
  );
}
