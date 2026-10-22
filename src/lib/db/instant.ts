import "server-only";
import { instantJoinErrorMessage, instantJoinState, type InstantJoinState } from "@/lib/core/instant-join";
import { HttpError } from "@/lib/http-error";
import { isToken } from "@/lib/validation";
import { serviceClient } from "./supabase";

/** Detail sesi Mabar Instan untuk halaman publik. Sengaja tanpa nama peserta, skor, biaya, dan token. */
export interface InstantSessionPreview {
  groupName: string;
  startsAt: Date;
  durationMin: number | null;
  venue: string | null;
  slotCount: number | null;
  taken: number;
  state: InstantJoinState;
}

/** Sesi menurut share_token, atau null bila token tidak dikenal. Slot terisi = attendee "going" atau hadir. */
export async function findInstantPreview(token: string): Promise<InstantSessionPreview | null> {
  if (!isToken(token)) return null;
  const { data, error } = await serviceClient()
    .from("sessions")
    .select("starts_at, duration_min, venue, status, slot_count, share_token_expires_at, groups!inner(name), attendees(rsvp, present)")
    .eq("share_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const taken = data.attendees.filter((a) => a.rsvp === "going" || a.present).length;
  const expiresAt = data.share_token_expires_at ? new Date(data.share_token_expires_at) : null;
  return {
    groupName: data.groups.name,
    startsAt: new Date(data.starts_at),
    durationMin: data.duration_min,
    venue: data.venue,
    slotCount: data.slot_count,
    taken,
    state: instantJoinState({ status: data.status, expiresAt, slotCount: data.slot_count, taken }, new Date()),
  };
}

/** Gabung sebagai tamu (p_user = null) lewat RPC atomik. claimToken dikembalikan untuk cookie tamu. */
export async function joinInstantSession(
  token: string,
  displayName: string,
): Promise<{ groupId: string; sessionId: string; memberId: string; claimToken: string | null }> {
  const { data, error } = await serviceClient().rpc("join_instant_session", {
    p_token: token,
    p_display_name: displayName,
    p_user: null as unknown as string,
  });
  const mapped = error ? instantJoinErrorMessage(error.message) : null;
  if (mapped) throw new HttpError(mapped.status, mapped.message);
  if (error?.code === "23505") throw new HttpError(409, "Nama ini sudah dipakai di grup. Coba nama lain.");
  if (error) throw error;
  const row = data[0];
  return { groupId: row.group_id, sessionId: row.session_id, memberId: row.member_id, claimToken: row.claim_token };
}
