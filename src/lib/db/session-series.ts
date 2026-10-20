import "server-only";
import { dueOccurrences, type Repeat } from "@/lib/core/recurrence";
import { courtCost } from "@/lib/core/split";
import { HttpError } from "@/lib/http-error";
import type { RepeatInput, SeriesPatchInput } from "@/lib/validation";
import { SHUTTLE_COUNTER, recomputeBill } from "./bill";
import type { Json } from "./database.types";
import { getGroup } from "./groups";
import { assignSeasons } from "./seasons";
import { getSession, type SessionDetail } from "./sessions";
import { serviceClient } from "./supabase";

/** Seri sesi berulang (PRD S5). Isi sesi baru disalin dari sesi terakhir seri; seri hanya menyimpan pengulangan & biaya. */
export interface SessionSeries {
  id: string;
  groupId: string;
  repeat: Repeat;
  /** tanggal sesi pertama (WIB); dasar hitungan tanggal */
  anchorDate: string;
  /** tanggal terakhir yang pernah dibuat */
  lastDate: string;
  ahead: number;
  courtPerHour: number | null;
  shuttleCost: number | null;
  paused: boolean;
}

export interface SeriesCosts {
  courtPerHour: number | null;
  shuttle: number | null;
}

const COLUMNS = "id, group_id, frequency, monthly_by, anchor_date, last_date, ahead, court_per_hour, shuttle_cost, paused" as const;

type Row = {
  id: string; group_id: string; frequency: string; monthly_by: string | null; anchor_date: string; last_date: string; ahead: number;
  court_per_hour: number | null; shuttle_cost: number | null; paused: boolean;
};

const toRepeat = (frequency: string, monthlyBy: string | null): Repeat =>
  frequency === "monthly" ? { frequency: "monthly", monthlyBy: monthlyBy === "weekday" ? "weekday" : "date" } : { frequency: "weekly" };

function toSeries(r: Row): SessionSeries {
  return {
    id: r.id,
    groupId: r.group_id,
    repeat: toRepeat(r.frequency, r.monthly_by),
    anchorDate: r.anchor_date,
    lastDate: r.last_date,
    ahead: r.ahead,
    courtPerHour: r.court_per_hour,
    shuttleCost: r.shuttle_cost,
    paused: r.paused,
  };
}

const repeatRow = (r: RepeatInput) => ({ frequency: r.frequency, monthly_by: r.frequency === "monthly" ? r.monthlyBy : null, ahead: r.ahead });

/** Biaya awal sesi untuk dipakai ulang (duplikat / seri): tarif sewa per jam (meta preset court) & kok yang bukan dari penghitung. */
export function initialCosts(session: SessionDetail): SeriesCosts {
  const court = session.expenses.find((e) => e.preset === "court" && typeof (e.meta as { perHour?: unknown } | null)?.perHour === "number");
  const shuttle = session.expenses.find((e) => e.preset === "shuttle" && (e.meta as { source?: string } | null)?.source !== SHUTTLE_COUNTER);
  return { courtPerHour: court ? (court.meta as { perHour: number }).perHour : null, shuttle: shuttle?.amount ?? null };
}

export async function getSeries(groupId: string, seriesId: string): Promise<SessionSeries | null> {
  const { data, error } = await serviceClient().from("session_templates").select(COLUMNS).eq("id", seriesId).eq("group_id", groupId).maybeSingle();
  if (error) throw error;
  return data ? toSeries(data) : null;
}

/** Jadikan sesi ini awal seri berulang, lalu siapkan sesi berikutnya. Panggil hanya setelah requireAdmin. */
export async function createSeries(session: SessionDetail, actorId: string, repeat: RepeatInput, costs: SeriesCosts, today: string): Promise<string> {
  const { data, error } = await serviceClient(actorId).rpc("create_session_series", {
    p_session: session.id,
    p_series: { ...repeatRow(repeat), court_per_hour: costs.courtPerHour, shuttle_cost: costs.shuttle },
    p_creator: actorId,
  });
  if (error?.code === "P0001") throw new HttpError(409, "Sesi ini sudah berulang.");
  if (error?.code === "P0002") throw new HttpError(404, "Sesi tidak ditemukan.");
  if (error) throw error;
  await ensureSeriesSessions([session.groupId], today);
  return data;
}

/** Ubah pengulangan & biaya default, atau jeda/lanjutkan. Sesi yang sudah dibuat tidak berubah. */
export async function updateSeries(groupId: string, seriesId: string, actorId: string, patch: SeriesPatchInput, today: string): Promise<void> {
  const row = "paused" in patch ? { paused: patch.paused } : { ...repeatRow(patch), court_per_hour: patch.courtPerHour, shuttle_cost: patch.shuttleCost };
  const { data, error } = await serviceClient(actorId).from("session_templates").update(row).eq("id", seriesId).eq("group_id", groupId).select("id");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, "Pengulangan tidak ditemukan.");
  await ensureSeriesSessions([groupId], today);
}

/** Hentikan pengulangan; sesi yang sudah dibuat tetap ada (template_id menjadi null). */
export async function deleteSeries(groupId: string, seriesId: string, actorId: string): Promise<void> {
  const { data, error } = await serviceClient(actorId).from("session_templates").delete().eq("id", seriesId).eq("group_id", groupId).select("id");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, "Pengulangan tidak ditemukan.");
}

/**
 * Pastikan tiap seri aktif di grup-grup ini sudah punya `ahead` sesi mendatang (dibuat saat aplikasi dibuka, tanpa cron).
 * Idempoten & aman dipanggil serentak: database menolak tanggal yang sudah pernah dibuat. Tidak pernah melempar galat,
 * agar halaman tetap tampil bila pembuatan gagal. `today` = tanggal WIB hari ini.
 */
export async function ensureSeriesSessions(groupIds: string[], today: string): Promise<number> {
  if (groupIds.length === 0) return 0;
  let created = 0;
  const touched = new Set<string>();
  try {
    const { data, error } = await serviceClient().from("session_templates").select(COLUMNS).in("group_id", groupIds).eq("paused", false);
    if (error) throw error;
    for (const series of data.map(toSeries)) {
      const dates = dueOccurrences(series.repeat, series.anchorDate, series.lastDate, today, series.ahead);
      if (dates.length === 0) continue;
      const { data: source, error: sourceError } = await serviceClient()
        .from("sessions")
        .select("id, court_count, duration_min")
        .eq("template_id", series.id)
        .order("template_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sourceError) throw sourceError;
      if (!source) continue; // semua sesi seri dihapus: tidak ada yang bisa disalin
      for (const date of dates) {
        const id = await createSeriesSession(series, date, source);
        if (!id) continue;
        created++;
        touched.add(series.groupId);
        const session = await getSession(series.groupId, id);
        if (session && session.presentIds.length > 0 && session.createdBy) {
          await recomputeBill(await getGroup(series.groupId), session, session.createdBy).catch((e) => console.error(e));
        }
      }
    }
    for (const groupId of touched) await assignSeasons(groupId);
  } catch (e) {
    console.error("[seri] gagal menyiapkan sesi berulang", e);
  }
  return created;
}

async function createSeriesSession(
  series: SessionSeries,
  date: string,
  source: { id: string; court_count: number; duration_min: number | null },
): Promise<string | null> {
  const expenses: { name: string; amount: number; preset: string; meta: Json }[] = [];
  if (series.courtPerHour && source.duration_min) {
    const durationMin = source.duration_min;
    expenses.push({
      name: "Sewa lapangan",
      amount: courtCost({ perHour: series.courtPerHour, courts: source.court_count, durationMin }),
      preset: "court",
      meta: { perHour: series.courtPerHour, courts: source.court_count, durationMin },
    });
  }
  if (series.shuttleCost) expenses.push({ name: "Kok", amount: series.shuttleCost, preset: "shuttle", meta: null });
  const { data, error } = await serviceClient().rpc("create_series_session", {
    p_series: series.id,
    p_date: date,
    p_source: source.id,
    p_expenses: expenses,
  });
  if (error) throw error;
  return data;
}
