import "server-only";
import { dueDates, durationBetween } from "@/lib/core/recurrence";
import { courtCost } from "@/lib/core/split";
import { HttpError } from "@/lib/http-error";
import { fromJakartaParts, toJakartaParts } from "@/lib/time";
import type { SessionTemplateInput } from "@/lib/validation";
import { recomputeBill } from "./bill";
import type { Json } from "./database.types";
import { getGroup } from "./groups";
import { assignSeasons } from "./seasons";
import { getSession } from "./sessions";
import { serviceClient } from "./supabase";

export interface SessionTemplate extends SessionTemplateInput {
  id: string;
  groupId: string;
  paused: boolean;
}

const COLUMNS = "id, group_id, weekday, start_time, end_time, venue, court_count, play_mode, court_per_hour, shuttle_cost, lead_days, paused" as const;

type Row = {
  id: string; group_id: string; weekday: number; start_time: string; end_time: string; venue: string | null; court_count: number;
  play_mode: string; court_per_hour: number | null; shuttle_cost: number | null; lead_days: number; paused: boolean;
};

const hhmm = (t: string) => t.slice(0, 5);

function toTemplate(r: Row): SessionTemplate {
  return {
    id: r.id,
    groupId: r.group_id,
    weekday: r.weekday,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    venue: r.venue,
    courtCount: r.court_count,
    playMode: r.play_mode as SessionTemplate["playMode"],
    courtPerHour: r.court_per_hour,
    shuttleCost: r.shuttle_cost,
    leadDays: r.lead_days,
    paused: r.paused,
  };
}

const toRow = (i: SessionTemplateInput) => ({
  weekday: i.weekday,
  start_time: i.startTime,
  end_time: i.endTime,
  venue: i.venue,
  court_count: i.courtCount,
  play_mode: i.playMode,
  court_per_hour: i.courtPerHour,
  shuttle_cost: i.shuttleCost,
  lead_days: i.leadDays,
});

export async function listTemplates(groupId: string): Promise<SessionTemplate[]> {
  const { data, error } = await serviceClient().from("session_templates").select(COLUMNS).eq("group_id", groupId).order("created_at");
  if (error) throw error;
  return data.map(toTemplate);
}

export async function createTemplate(groupId: string, actorId: string, input: SessionTemplateInput): Promise<string> {
  const { data, error } = await serviceClient(actorId)
    .from("session_templates")
    .insert({ ...toRow(input), group_id: groupId, created_by: actorId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Ubah isi atau jeda/lanjutkan template. Sesi yang sudah dibuat tidak disentuh. */
export async function updateTemplate(groupId: string, templateId: string, actorId: string, patch: SessionTemplateInput | { paused: boolean }): Promise<void> {
  const row = "paused" in patch ? { paused: patch.paused } : toRow(patch);
  const { data, error } = await serviceClient(actorId).from("session_templates").update(row).eq("id", templateId).eq("group_id", groupId).select("id");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, "Jadwal tidak ditemukan.");
}

/** Hapus template; sesi hasilnya tetap ada (template_id menjadi null). */
export async function deleteTemplate(groupId: string, templateId: string, actorId: string): Promise<void> {
  const { data, error } = await serviceClient(actorId).from("session_templates").delete().eq("id", templateId).eq("group_id", groupId).select("id");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, "Jadwal tidak ditemukan.");
}

export interface GenerateResult {
  templates: number;
  created: number;
}

/**
 * Buat sesi Rencana yang jatuh tempo untuk semua template aktif. Idempoten: pasangan (template, tanggal) yang
 * sudah ada dilewati di database. `today` = tanggal WIB hari ini, diberikan pemanggil (job terjadwal).
 */
export async function generateDueSessions(today: string): Promise<GenerateResult> {
  const { data, error } = await serviceClient().from("session_templates").select(COLUMNS).eq("paused", false);
  if (error) throw error;
  let created = 0;
  for (const template of data.map(toTemplate)) {
    for (const date of dueDates(template.weekday, today, template.leadDays)) {
      try {
        if (await createFromTemplate(template, date)) created++;
      } catch (e) {
        console.error("[jadwal] gagal membuat sesi", template.id, date, e);
      }
    }
  }
  return { templates: data.length, created };
}

async function createFromTemplate(t: SessionTemplate, date: string): Promise<boolean> {
  const startsAt = fromJakartaParts(date, t.startTime);
  if (!startsAt) throw new RangeError(`tanggal tidak valid: ${date}`);
  const durationMin = durationBetween(t.startTime, t.endTime);
  const expenses: { name: string; amount: number; preset: string; meta: Json }[] = [];
  if (t.courtPerHour) {
    expenses.push({
      name: "Sewa lapangan",
      amount: courtCost({ perHour: t.courtPerHour, courts: t.courtCount, durationMin }),
      preset: "court",
      meta: { perHour: t.courtPerHour, courts: t.courtCount, durationMin },
    });
  }
  if (t.shuttleCost) expenses.push({ name: "Kok", amount: t.shuttleCost, preset: "shuttle", meta: null });

  const { data, error } = await serviceClient().rpc("create_template_session", {
    p_template: t.id,
    p_date: date,
    p_session: { starts_at: startsAt.toISOString(), duration_min: durationMin },
    p_expenses: expenses,
  });
  if (error) throw error;
  if (!data) return false;
  const session = await getSession(t.groupId, data);
  if (session && session.presentIds.length > 0) await recomputeBill(await getGroup(t.groupId), session, session.createdBy).catch((e) => console.error(e));
  await assignSeasons(t.groupId);
  return true;
}

export const todayWib = (now: Date) => toJakartaParts(now).date;
