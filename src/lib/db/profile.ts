import "server-only";
import type { PayStatus } from "@/lib/core/split";
import { isUuid } from "@/lib/validation";
import { serviceClient } from "./supabase";

export interface MemberProfile {
  id: string;
  displayName: string;
  role: "admin" | "member";
  grade: "A" | "B" | "C" | "D" | null;
  /** null = tamu (belum terhubung akun) */
  userId: string | null;
  isActive: boolean;
}

/** Anggota grup (termasuk nonaktif), atau null. Panggil hanya setelah requireMember. */
export async function getMemberProfile(groupId: string, memberId: string): Promise<MemberProfile | null> {
  const { data, error } = await serviceClient()
    .from("members")
    .select("id, display_name, role, grade, user_id, is_active")
    .eq("group_id", groupId)
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  return data && { id: data.id, displayName: data.display_name, role: data.role, grade: data.grade, userId: data.user_id, isActive: data.is_active };
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

/** Transfer patungan yang melibatkan anggota di semua sesi grup, terbaru dulu (X2 "tagihan"). */
export async function memberSettlements(groupId: string, memberId: string): Promise<MemberSettlement[]> {
  if (!isUuid(memberId)) return []; // dipakai di filter PostgREST `or(...)`
  const { data, error } = await serviceClient()
    .from("settlements")
    .select("id, session_id, from_member, to_member, amount, status, self_reported, sessions!inner(group_id, starts_at, venue)")
    .eq("sessions.group_id", groupId)
    .or(`from_member.eq.${memberId},to_member.eq.${memberId}`);
  if (error) throw error;
  return data
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
