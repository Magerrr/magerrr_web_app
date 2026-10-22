export type InstantJoinState = "valid" | "expired" | "full";

/** Keadaan tautan Mabar Instan. Murni: waktu diberikan sebagai argumen. slotCount null = tanpa batas. */
export function instantJoinState(
  s: { status: string; expiresAt: Date | null; slotCount: number | null; taken: number },
  now: Date,
): InstantJoinState {
  if (s.status === "finished" || (s.expiresAt !== null && s.expiresAt.getTime() < now.getTime())) return "expired";
  if (s.slotCount !== null && s.taken >= s.slotCount) return "full";
  return "valid";
}

export const INSTANT_EXPIRED_MESSAGE = "Tautan ini sudah kedaluwarsa. Minta tautan baru ke host.";
export const INSTANT_FULL_MESSAGE = "Slot sudah penuh. Coba hubungi host.";

/** Pesan RPC join_instant_session (P0001) → pesan pengguna; null bila bukan error yang dikenal. */
export function instantJoinErrorMessage(rpcMessage: string): { status: 404 | 409; message: string } | null {
  if (rpcMessage.includes("session_expired")) return { status: 404 as const, message: INSTANT_EXPIRED_MESSAGE };
  if (rpcMessage.includes("session_full")) return { status: 409 as const, message: INSTANT_FULL_MESSAGE };
  return null;
}
