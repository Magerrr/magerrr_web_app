"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NumberField, toInt } from "@/components/rules-picker";
import { toast } from "@/components/toast";
import { Button, Card } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { repeatLabel, type Repeat } from "@/lib/core/recurrence";
import { formatRupiah } from "@/lib/format";
import { RepeatFields, repeatBody, type RepeatDraft } from "../repeat-fields";

export interface SeriesView {
  id: string;
  repeat: Repeat;
  anchorDate: string;
  ahead: number;
  courtPerHour: number | null;
  shuttleCost: number | null;
  paused: boolean;
}

const draftOf = (repeat: Repeat, ahead: number): RepeatDraft => ({
  frequency: repeat.frequency,
  monthlyBy: repeat.frequency === "monthly" ? repeat.monthlyBy : "weekday",
  ahead,
});

/** Ubah pengulangan & biaya default seri yang sudah ada. */
function SeriesEditor({ groupId, series, onDone }: { groupId: string; series: SeriesView; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(draftOf(series.repeat, series.ahead));
  const [courtPerHour, setCourtPerHour] = useState(series.courtPerHour ? String(series.courtPerHour) : "");
  const [shuttle, setShuttle] = useState(series.shuttleCost ? String(series.shuttleCost) : "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/series/${series.id}`, "PATCH", {
      ...repeatBody(draft),
      courtPerHour: courtPerHour.trim() ? toInt(courtPerHour) : null,
      shuttleCost: shuttle.trim() ? toInt(shuttle) : null,
    });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast("Pengulangan disimpan. Berlaku untuk sesi yang dibuat berikutnya.");
    onDone();
    router.refresh();
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <RepeatFields id="series" anchor={series.anchorDate} value={draft} onChange={setDraft} allowNone={false} />
      <NumberField id="series-court" label="Sewa per lapangan per jam (Rp)" value={courtPerHour} onChange={setCourtPerHour} className="w-full" />
      <NumberField id="series-shuttle" label="Biaya kok (Rp)" value={shuttle} onChange={setShuttle} className="w-full" />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Simpan pengulangan
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Batal
        </Button>
      </div>
    </form>
  );
}

/** Jadikan sesi ini berulang. Biaya default diambil server dari biaya awal sesi. */
function StartSeries({ groupId, sessionId, sessionDate, onDone }: { groupId: string; sessionId: string; sessionDate: string; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RepeatDraft>({ frequency: "weekly", monthlyBy: "weekday", ahead: 1 });
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/sessions/${sessionId}/series`, "POST", repeatBody(draft));
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast("Sesi ini sekarang berulang.");
    onDone();
    router.refresh();
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <RepeatFields id="series" anchor={sessionDate} value={draft} onChange={setDraft} allowNone={false} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Simpan pengulangan
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Batal
        </Button>
      </div>
    </form>
  );
}

/** Kartu "Sesi berulang" di halaman sesi (S5): ringkasan untuk semua anggota; ubah/jeda/hentikan untuk admin. */
export function SeriesPanel({
  groupId,
  sessionId,
  sessionDate,
  series,
  isAdmin,
  canStart,
}: {
  groupId: string;
  sessionId: string;
  /** tanggal sesi ini (WIB), jadi tanggal awal bila sesi dijadikan berulang */
  sessionDate: string;
  series: SeriesView | null;
  isAdmin: boolean;
  /** sesi belum selesai, boleh dijadikan berulang */
  canStart: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(method: "PATCH" | "DELETE", body: unknown, done: string) {
    setBusy(true);
    const result = await sendJson(`/api/groups/${groupId}/series/${series!.id}`, method, body);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast(done);
    router.refresh();
  }

  if (!series) {
    if (!isAdmin || !canStart) return null;
    return (
      <Card className="flex flex-col gap-4" data-testid="series-panel">
        <h2 className="text-sub">Sesi berulang</h2>
        {editing ? (
          <StartSeries groupId={groupId} sessionId={sessionId} sessionDate={sessionDate} onDone={() => setEditing(false)} />
        ) : (
          <>
            <p className="text-ui">Main rutin tiap minggu atau tiap bulan? Sesi berikutnya dibuat otomatis dari sesi ini.</p>
            <div>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Ulangi sesi ini
              </Button>
            </div>
          </>
        )}
      </Card>
    );
  }

  const costs = [
    series.courtPerHour ? `sewa ${formatRupiah(series.courtPerHour)}/lapangan/jam` : null,
    series.shuttleCost ? `kok ${formatRupiah(series.shuttleCost)}` : null,
  ].filter(Boolean);

  return (
    <Card className="flex flex-col gap-4" data-testid="series-panel">
      <h2 className="text-sub">Sesi berulang</h2>
      {editing ? (
        <SeriesEditor groupId={groupId} series={series} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-ui">{repeatLabel(series.repeat, series.anchorDate)}</p>
            <p className="text-small">
              {series.paused ? "Dijeda — tidak membuat sesi baru." : `${series.ahead} sesi mendatang selalu disiapkan.`}
              {costs.length > 0 && ` Biaya default: ${costs.join(", ")}.`}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
                Ubah
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => run("PATCH", { paused: !series.paused }, series.paused ? "Pengulangan dilanjutkan." : "Pengulangan dijeda.")}
              >
                {series.paused ? "Lanjutkan" : "Jeda"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Hentikan pengulangan? Sesi yang sudah dibuat tidak ikut terhapus.")) void run("DELETE", undefined, "Pengulangan dihentikan.");
                }}
              >
                Hentikan
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
