import "server-only";
import type { PayStatus } from "@/lib/core/split";
import { isUuid } from "@/lib/validation";
import { memberAvatarUrl } from "./account";
import { serviceClient } from "./supabase";

export interface MemberProfile {
  id: string;
  displayName: string;
  role: "admin" | "referee" | "member";
  grade: "A" | "B" | "C" | "D" | null;
  /** null = tamu (belum terhubung akun) */
  userId: string | null;
  isActive: boolean;
  /** foto profil akun (MAGERRR-12), atau null */
  avatarUrl: string | null;
}

/** Anggota grup (termasuk nonaktif), atau null. Panggil hanya setelah requireMember. */
export async function getMemberProfile(groupId: string, memberId: string): Promise<MemberProfile | null> {
  const { data, error } = await serviceClient()
    .from("members")
    .select("id, display_name, role, grade, user_id, is_active, profiles(avatar_path)")
    .eq("group_id", groupId)
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  return (
    data && {
      id: data.id,
      displayName: data.display_name,
      role: data.role,
      grade: data.grade,
      userId: data.user_id,
      isActive: data.is_active,
      avatarUrl: memberAvatarUrl(groupId, data.id, data.profiles?.avatar_path ?? null),
    }
  );
}

export interface MemberSettlement {
  id: string;
  sessionId: string;
  startsAt: Date;
  venue: string | null;
  from: string;
  to: string;
  amount: number;
  status: PayStatus;
  selfReported: boolean;
}

const SETTLEMENT_COLUMNS = "id, session_id, from_member, to_member, amount, status, self_reported, sessions!inner(group_id, starts_at, venue)";

type SettlementRow = {
  id: string;
  session_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  status: PayStatus;
  self_reported: boolean;
  sessions: { starts_at: string; venue: string | null };
};

function toSettlements(rows: SettlementRow[]): MemberSettlement[] {
  return rows
    .map((s) => ({
      id: s.id,
      sessionId: s.session_id,
      startsAt: new Date(s.sessions.starts_at),
      venue: s.sessions.venue,
      from: s.from_member,
      to: s.to_member,
      amount: s.amount,
      status: s.status,
      selfReported: s.self_reported,
    }))
    .sort((x, y) => y.startsAt.getTime() - x.startsAt.getTime());
}

/** Transfer patungan yang melibatkan anggota di semua sesi grup, terbaru dulu (X2 "tagihan"). */
export async function memberSettlements(groupId: string, memberId: string): Promise<MemberSettlement[]> {
  if (!isUuid(memberId)) return []; // dipakai di filter PostgREST `or(...)`
  const { data, error } = await serviceClient()
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("sessions.group_id", groupId)
    .or(`from_member.eq.${memberId},to_member.eq.${memberId}`);
  if (error) throw error;
  return toSettlements(data);
}

/** Transfer patungan yang belum lunas di semua sesi grup, terbaru dulu (P10 saldo lintas sesi). */
export async function unpaidGroupSettlements(groupId: string): Promise<MemberSettlement[]> {
  const result: SettlementRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await serviceClient()
      .from("settlements")
      .select(SETTLEMENT_COLUMNS)
      .eq("sessions.group_id", groupId)
      .eq("status", "unpaid")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    result.push(...data);
    if (data.length < 1000) break;
  }
  return toSettlements(result);
}
