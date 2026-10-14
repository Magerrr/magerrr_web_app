// Pencatat skor per lapangan (ALGORITHMS §1d): paling banyak satu pemain yang memegang skor satu lapangan.
import type { MemberId } from "./types";

export interface ScorerActor {
  id: MemberId;
  isAdmin: boolean;
}

/** Siapa yang boleh mengubah skor lapangan: pencatat yang ditunjuk; tanpa pencatat → admin. */
export function canScore(scorer: MemberId | null, actor: ScorerActor): boolean {
  return scorer === null ? actor.isAdmin : scorer === actor.id;
}

export type ScorerRefusal = "not_present" | "taken" | "not_allowed";

/**
 * Perubahan pencatat `current → next` oleh `actor`; null = boleh.
 * Admin bebas menunjuk peserta hadir mana pun atau mengosongkan (kembali ke admin).
 * Pemain lain hanya bisa mengajukan diri saat lapangan belum punya pencatat, atau melepas kontrolnya sendiri.
 */
export function scorerRefusal(current: MemberId | null, next: MemberId | null, actor: ScorerActor, present: readonly MemberId[]): ScorerRefusal | null {
  if (next !== null && !present.includes(next)) return "not_present";
  if (actor.isAdmin) return null;
  if (next === null) return current === actor.id || current === null ? null : "not_allowed";
  if (next !== actor.id) return "not_allowed";
  return current === null || current === actor.id ? null : "taken";
}
