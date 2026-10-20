import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { metricsFrom, type MetricEvent, type SessionMetricInput } from "@/lib/core/metrics";
import { serviceClient } from "./supabase";

export const DEVICE_COOKIE = "mg_perangkat";

/**
 * Catat event metrik (PRD §4). Idempotensi lewat unique (sesi, event, dedupe): pencatatan ulang diabaikan.
 * Gagal mencatat tidak boleh menggagalkan aksi pengguna.
 */
export async function recordMetric(groupId: string, sessionId: string, event: MetricEvent, dedupe = ""): Promise<void> {
  try {
    const { error } = await serviceClient()
      .from("metric_events")
      .upsert({ group_id: groupId, session_id: sessionId, event, dedupe }, { onConflict: "session_id,event,dedupe", ignoreDuplicates: true });
    if (error) console.error("[metrik] gagal mencatat", event, error.message);
  } catch (error) {
    console.error("[metrik] gagal mencatat", event, error);
  }
}

/** Kunci pembuka link: hash satu arah dari id anggota atau id perangkat acak (cookie), per sesi. */
export function viewerKey(sessionId: string, identity: string): string {
  return createHash("sha256").update(`${sessionId}:${identity}`).digest("hex").slice(0, 32);
}

/** Id perangkat dari cookie; dibuat (dan dikirim lewat Set-Cookie) bila belum ada. Hanya dari route handler. */
export async function deviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  store.set(DEVICE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return id;
}

/** Masukan metrik semua sesi grup sejak 8 pekan terakhir (menurut tanggal main). Panggil hanya setelah requireAdmin. */
export async function loadGroupMetricInputs(groupId: string, now: Date): Promise<SessionMetricInput[]> {
  const db = serviceClient();
  const { data: sessions, error } = await db
    .from("sessions")
    .select("id, starts_at, status, created_by, attendees(member_id, present, members(role))")
    .eq("group_id", groupId)
    .gte("starts_at", metricsFrom(now).toISOString());
  if (error) throw error;
  if (sessions.length === 0) return [];
  const { data: events, error: eventError } = await db
    .from("metric_events")
    .select("session_id, event, created_at")
    .in("session_id", sessions.map((s) => s.id))
    .neq("event", "link_opened");
  if (eventError) throw eventError;
  const { data: opens, error: openError } = await db
    .from("metric_events")
    .select("session_id")
    .in("session_id", sessions.map((s) => s.id))
    .eq("event", "link_opened");
  if (openError) throw openError;

  const seen = new Map<string, Map<string, Date>>();
  for (const e of events) {
    const m = seen.get(e.session_id) ?? new Map<string, Date>();
    m.set(e.event, new Date(e.created_at));
    seen.set(e.session_id, m);
  }
  const openers = new Map<string, number>();
  for (const o of opens) openers.set(o.session_id, (openers.get(o.session_id) ?? 0) + 1);

  return sessions.map((s) => {
    const ev = seen.get(s.id);
    // Host = pembuat sesi atau admin grup; link_opened hanya dicatat untuk non-host (lihat route /api/events).
    const nonHost = s.attendees.filter((a) => a.present && a.member_id !== s.created_by && a.members?.role !== "admin").length;
    return {
      startsAt: new Date(s.starts_at),
      finished: s.status === "finished",
      createdAt: ev?.get("session_created") ?? null,
      finishedAt: ev?.get("session_finished") ?? null,
      hasScore: ev?.has("score_recorded") ?? false,
      hasBill: ev?.has("bill_created") ?? false,
      recapShared: ev?.has("recap_shared") ?? false,
      nonHostPlayers: nonHost,
      nonHostOpeners: openers.get(s.id) ?? 0,
    };
  });
}
