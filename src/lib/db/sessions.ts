import "server-only";
import type { GameRules } from "@/lib/core/rules";
import { checkTransition, type SessionStatus } from "@/lib/core/session";
import { courtCost, type Expense, type SettlementState } from "@/lib/core/split";
import { HttpError } from "@/lib/http-error";
import { fromJakartaParts } from "@/lib/time";
import type { VenueLocation } from "@/lib/venue";
import { isToken, type SessionCreateInput, type SessionUpdateInput } from "@/lib/validation";
import { recomputeBill } from "./bill";
import { assignSeasons } from "./seasons";
import type { Json } from "./database.types";
import type { GroupSettings } from "./groups";
import { serviceClient } from "./supabase";

export interface SessionSummary {
  id: string;
  startsAt: Date;
  durationMin: number | null;
  venue: string | null;
  courtCount: number;
  status: SessionStatus;
  presentCount: number;
}

export type RsvpStatus = "going" | "not_going" | "maybe";

export interface ShuttleCounter {
  pricePerSlop: number | null;
  perSlop: number;
  used: number;
}

export interface SessionDetail extends SessionSummary {
  groupId: string;
  playMode: "kocok" | "rotasi" | "fix_pasangan" | "round_robin";
  /** override sesi; null = aturan grup */
  rules: GameRules | null;
  matchGames: 1 | 3 | 5 | null;
  note: string | null;
  createdBy: string | null;
  presentIds: string[];
  /** antrian mode rotasi; null = rotasi belum dimulai */
  rotationQueue: string[] | null;
  expenses: (Expense & { name: string; preset: string | null; splitAll: boolean; meta: Json | null })[];
  /** token halaman publik sesi (tagihan / recap) */
  shareToken: string;
  /** recap boleh dibuka tanpa login (R5) */
  recapPublic: boolean;
  /** mode fix_pasangan: pasangan tetap sesi ini; null = belum diatur */
  fixedPairs: [string, string][] | null;
  /** jawaban RSVP anggota (S3); tidak mengubah kehadiran */
  rsvp: Record<string, RsvpStatus>;
  /** penghitung kok (§5.5); pricePerSlop null = belum diisi */
  shuttle: ShuttleCounter;
  /** iuran flat per peserta (§5.7, MAGERRR-14); null = bagi rata */
  flatFee: number | null;
  /** tautan peta / titik tempat (MAGERRR-18) */
  location: VenueLocation;
}

const SUMMARY_COLUMNS = "id, starts_at, duration_min, venue, court_count, status, attendees(count)" as const;

/** Karakter yang bermakna khusus di filter PostgREST `or(...)` / pola ilike dibuang. */
const searchTerm = (q: string) => q.replace(/[%_,()*\\"'.:]/g, " ").trim().slice(0, 50);

/** Riwayat sesi grup, terbaru dulu (X1). Panggil hanya setelah requireMember. */
export async function listSessions(groupId: string, q = ""): Promise<SessionSummary[]> {
  let query = serviceClient()
    .from("sessions")
    .select(SUMMARY_COLUMNS)
    .eq("group_id", groupId)
    .eq("attendees.present", true)
    .order("starts_at", { ascending: false })
    .limit(100);
  const term = searchTerm(q);
  if (term) query = query.or(`venue.ilike.%${term}%,note.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    startsAt: new Date(s.starts_at),
    durationMin: s.duration_min,
    venue: s.venue,
    courtCount: s.court_count,
    status: s.status,
    presentCount: s.attendees[0]?.count ?? 0,
  }));
}

export interface GroupSessionSummary extends SessionSummary {
  groupId: string;
}

/**
 * Sesi dari beberapa grup sekaligus (beranda & "Semua sesi", MAGERRR-13), jam mulai terbaru dulu, paling banyak `limit`.
 * Sesi mendatang ikut di atas karena urutan menurun. Panggil hanya dengan grup milik pengunjung (listMyGroups).
 */
export async function listSessionsOfGroups(groupIds: string[], limit = 100): Promise<GroupSessionSummary[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await serviceClient()
    .from("sessions")
    .select(`group_id, ${SUMMARY_COLUMNS}`)
    .in("group_id", groupIds)
    .eq("attendees.present", true)
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    groupId: s.group_id,
    startsAt: new Date(s.starts_at),
    durationMin: s.duration_min,
    venue: s.venue,
    courtCount: s.court_count,
    status: s.status,
    presentCount: s.attendees[0]?.count ?? 0,
  }));
}

/** Detail sesi milik grup, atau null bila tidak ada / milik grup lain. */
export async function getSession(groupId: string, sessionId: string): Promise<SessionDetail | null> {
  const db = serviceClient();
  const { data: s, error } = await db
    .from("sessions")
    .select(
      "id, group_id, starts_at, duration_min, venue, venue_url, venue_lat, venue_lng, court_count, status, play_mode, rules, match_games, note, created_by, rotation_queue, share_token, recap_public, shuttle_price_per_slop, shuttle_per_slop, shuttles_used, fixed_pairs, flat_fee, attendees(member_id, present, rsvp), expenses(id, name, amount, paid_by, mode, preset, split_all, meta)",
    )
    .eq("id", sessionId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!s) return null;
  const presentIds = s.attendees.filter((a) => a.present).map((a) => a.member_id);
  return {
    id: s.id,
    groupId: s.group_id,
    startsAt: new Date(s.starts_at),
    durationMin: s.duration_min,
    venue: s.venue,
    courtCount: s.court_count,
    status: s.status,
    presentCount: presentIds.length,
    playMode: s.play_mode,
    rules: s.rules as unknown as GameRules | null,
    matchGames: s.match_games as SessionDetail["matchGames"],
    note: s.note,
    createdBy: s.created_by,
    presentIds,
    rotationQueue: s.rotation_queue,
    shareToken: s.share_token,
    recapPublic: s.recap_public,
    fixedPairs: (s.fixed_pairs as [string, string][] | null) ?? null,
    rsvp: Object.fromEntries(s.attendees.filter((a) => a.rsvp !== null).map((a) => [a.member_id, a.rsvp!])),
    shuttle: { pricePerSlop: s.shuttle_price_per_slop, perSlop: s.shuttle_per_slop, used: s.shuttles_used },
    flatFee: s.flat_fee,
    location: { url: s.venue_url, lat: s.venue_lat, lng: s.venue_lng },
    expenses: s.expenses.map((e) => ({
      id: e.id,
      name: e.name,
      amount: e.amount,
      paidBy: e.paid_by,
      mode: e.mode,
      preset: e.preset,
      splitAll: e.split_all,
      meta: e.meta,
    })),
  };
}

/**
 * Hapus sesi (MAGERRR-17): kehadiran, match, biaya, tagihan, turnamen, dan pencatat skor ikut terhapus; momen tetap
 * ada tanpa sesi. Ringkasan sebelum hapus dicatat di audit_log oleh RPC. Panggil hanya setelah requireAdmin.
 */
export async function deleteSession(session: SessionDetail, actorId: string): Promise<void> {
  const { error } = await serviceClient(actorId).rpc("delete_session", { p_session: session.id });
  if (error?.code === "P0002") throw new HttpError(404, "Sesi tidak ditemukan.");
  if (error) throw error;
}

/** Sesi dari token halaman publik (tanpa login), atau null. */
export async function findSessionByShareToken(token: string): Promise<SessionDetail | null> {
  if (!isToken(token)) return null;
  const { data, error } = await serviceClient().from("sessions").select("id, group_id").eq("share_token", token).maybeSingle();
  if (error) throw error;
  return data ? getSession(data.group_id, data.id) : null;
}

/** Peserta hadir di sesi terakhir yang punya peserta (default form sesi baru, PRD Flow A). */
export async function lastPresentMemberIds(groupId: string): Promise<string[]> {
  const { data, error } = await serviceClient()
    .from("sessions")
    .select("attendees!inner(member_id, present, members!inner(is_active, role))")
    .eq("group_id", groupId)
    .eq("attendees.present", true)
    .eq("attendees.members.is_active", true)
    .neq("attendees.members.role", "referee")
    .order("starts_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0]?.attendees.map((a) => a.member_id) ?? [];
}

const sameRules = (a: GameRules, b: GameRules) => a.target === b.target && a.deuce === b.deuce && a.cap === b.cap;

function sessionRow(input: SessionUpdateInput, group: GroupSettings) {
  const startsAt = fromJakartaParts(input.date, input.time);
  if (!startsAt) throw new HttpError(400, "Tanggal atau jam tidak valid.");
  return {
    starts_at: startsAt.toISOString(),
    venue: input.venue,
    venue_url: input.venueUrl,
    venue_lat: input.venuePoint?.lat ?? null,
    venue_lng: input.venuePoint?.lng ?? null,
    court_count: input.courtCount,
    duration_min: input.durationMin,
    play_mode: input.playMode,
    // Simpan override hanya bila berbeda dari aturan grup.
    rules: input.rules && !sameRules(input.rules, group.rules) ? { ...input.rules } : null,
    match_games: input.matchGames && input.matchGames !== group.matchGames ? input.matchGames : null,
    note: input.note,
  };
}

export async function assertMembersOf(
  groupId: string,
  memberIds: string[],
  message = "Ada peserta yang bukan anggota grup ini.",
): Promise<void> {
  if (memberIds.length === 0) return;
  const unique = [...new Set(memberIds)];
  const { count, error } = await serviceClient()
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("is_active", true)
    .in("id", unique);
  if (error) throw error;
  if (count !== unique.length) throw new HttpError(422, message);
}

/** Wasit tidak ikut bermain (MAGERRR-11): tolak (422) bila ada wasit di daftar peserta. */
export async function assertPlayersOf(groupId: string, memberIds: string[]): Promise<void> {
  if (memberIds.length === 0) return;
  const { count, error } = await serviceClient()
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("role", "referee")
    .in("id", [...new Set(memberIds)]);
  if (error) throw error;
  if (count) throw new HttpError(422, "Wasit mengurus permainan dan tidak jadi peserta. Ubah perannya dulu bila ingin ikut main.");
}

/** Buat sesi + peserta + biaya awal. Panggil hanya setelah requireAdmin. */
export async function createSession(group: GroupSettings, actorMemberId: string, input: SessionCreateInput): Promise<string> {
  await assertMembersOf(group.id, input.attendeeIds);
  await assertPlayersOf(group.id, input.attendeeIds);
  const row = sessionRow(input, group);
  const expenses: { name: string; amount: number; preset: string; meta: Json }[] = [];
  if (input.costs.courtPerHour) {
    const amount = courtCost({ perHour: input.costs.courtPerHour, courts: input.courtCount, durationMin: input.durationMin });
    expenses.push({
      name: "Sewa lapangan",
      amount,
      preset: "court",
      meta: { perHour: input.costs.courtPerHour, courts: input.courtCount, durationMin: input.durationMin },
    });
  }
  if (input.costs.shuttle) expenses.push({ name: "Kok", amount: input.costs.shuttle, preset: "shuttle", meta: null });

  const { data, error } = await serviceClient(actorMemberId).rpc("create_session", {
    p_group: group.id,
    p_creator: actorMemberId,
    p_session: row,
    p_attendees: [...new Set(input.attendeeIds)],
    p_expenses: expenses,
  });
  if (error) throw error;
  // Bagian per orang & transfer untuk biaya awal. Gagal di sini tidak membatalkan sesi:
  // halaman Patungan menawarkan "Hitung ulang" bila tagihan belum sesuai.
  const session = await getSession(group.id, data);
  if (session) await recomputeBill(group, session, actorMemberId).catch((e) => console.error(e));
  await assignSeasons(group.id);
  return data;
}

function assertEditable(session: SessionDetail): void {
  if (session.status === "finished") throw new HttpError(422, "Sesi sudah selesai dan tidak bisa diubah.");
}

export async function updateSession(group: GroupSettings, session: SessionDetail, input: SessionUpdateInput): Promise<void> {
  assertEditable(session);
  const { error } = await serviceClient().from("sessions").update(sessionRow(input, group)).eq("id", session.id);
  if (error) throw error;
  await assignSeasons(group.id); // tanggal bisa pindah musim
}

/**
 * Tetapkan siapa yang hadir: anggota di daftar → present, peserta lain → tidak hadir.
 * Tagihan dihitung ulang di transaksi yang sama (biaya "rata ke semua peserta hadir" ikut berubah).
 */
export async function setAttendees(
  group: GroupSettings,
  session: SessionDetail,
  actorId: string,
  memberIds: string[],
): Promise<{ reset: SettlementState[] }> {
  assertEditable(session);
  await assertMembersOf(session.groupId, memberIds);
  await assertPlayersOf(session.groupId, memberIds);
  return recomputeBill(group, session, actorId, memberIds);
}

/**
 * Anggota jadi wasit: keluarkan dari peserta sesi yang belum dimulai (tagihan ikut dihitung ulang).
 * Sesi berlangsung dan selesai dibiarkan agar match dan patungan yang sudah ada tidak berubah.
 */
export async function removeFromPlannedSessions(group: GroupSettings, memberId: string, actorId: string): Promise<void> {
  const { data, error } = await serviceClient()
    .from("sessions")
    .select("id, attendees!inner(member_id, present)")
    .eq("group_id", group.id)
    .eq("status", "planned")
    .eq("attendees.member_id", memberId)
    .eq("attendees.present", true);
  if (error) throw error;
  for (const row of data) {
    const session = await getSession(group.id, row.id);
    if (session) await setAttendees(group, session, actorId, session.presentIds.filter((id) => id !== memberId));
  }
}

/** RSVP diri sendiri (S3): hanya mencatat jawaban; kehadiran tetap ditentukan admin. */
export async function setRsvp(session: SessionDetail, memberId: string, rsvp: RsvpStatus): Promise<void> {
  if (session.status === "finished") throw new HttpError(422, "Sesi sudah selesai.");
  const { error } = await serviceClient()
    .from("attendees")
    .upsert({ session_id: session.id, member_id: memberId, rsvp }, { onConflict: "session_id,member_id" });
  if (error) throw error;
}

/** Pasangan tetap (mode fix_pasangan). Panggil setelah validasi pasangan & kehadiran. */
export async function setFixedPairs(session: SessionDetail, pairs: [string, string][]): Promise<void> {
  assertEditable(session);
  const { error } = await serviceClient().from("sessions").update({ fixed_pairs: pairs }).eq("id", session.id);
  if (error) throw error;
}

/** Penghitung kok (admin); sesi selesai terkunci. */
export async function setShuttle(session: SessionDetail, input: ShuttleCounter): Promise<void> {
  assertEditable(session);
  const { error } = await serviceClient()
    .from("sessions")
    .update({ shuttle_price_per_slop: input.pricePerSlop, shuttle_per_slop: input.perSlop, shuttles_used: input.used })
    .eq("id", session.id);
  if (error) throw error;
}

/** Harga slop terakhir yang dipakai grup (isian awal penghitung kok). */
export async function lastShuttlePrice(groupId: string): Promise<number | null> {
  const { data, error } = await serviceClient()
    .from("sessions")
    .select("shuttle_price_per_slop")
    .eq("group_id", groupId)
    .not("shuttle_price_per_slop", "is", null)
    .order("starts_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0]?.shuttle_price_per_slop ?? null;
}

export async function setRecapPublic(session: SessionDetail, value: boolean): Promise<void> {
  const { error } = await serviceClient().from("sessions").update({ recap_public: value }).eq("id", session.id);
  if (error) throw error;
}

export async function setStatus(session: SessionDetail, to: SessionStatus): Promise<void> {
  const check = checkTransition(session.status, to, session.presentCount);
  if (!check.ok) throw new HttpError(422, check.reason);
  // Hanya berhasil bila status belum diubah orang lain sejak dibaca.
  const { data, error } = await serviceClient()
    .from("sessions")
    .update({ status: to })
    .eq("id", session.id)
    .eq("status", session.status)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(409, "Status sesi sudah berubah. Muat ulang halaman.");
}
