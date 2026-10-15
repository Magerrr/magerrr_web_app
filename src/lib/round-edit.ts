// Edit usulan ronde di papan skor (MAGERRR-10): tukar pemain antar slot dan pindah/tukar lapangan sebelum match dimulai.
// Murni (tanpa state React) agar bisa dites; dipakai RoundPlanner untuk tap, seret-lepas, dan pilihan lapangan.
import type { MatchKind, MemberId } from "@/lib/core/types";

export interface EditableLineup {
  courtNo: number;
  kind: MatchKind;
  A: MemberId[];
  B: MemberId[];
}

export interface EditableRound {
  courts: EditableLineup[];
  waiting: MemberId[];
}

/** Posisi pemain di usulan: slot tim di lapangan (indeks `courts`), atau urutan di daftar tunggu. */
export type Slot = { court: number; side: "A" | "B"; index: number } | { court: null; index: number };

export const sameSlot = (x: Slot, y: Slot) =>
  x.court === y.court && x.index === y.index && (x.court === null || (y.court !== null && x.side === y.side));

export function readSlot(p: EditableRound, s: Slot): MemberId {
  return s.court === null ? p.waiting[s.index] : p.courts[s.court][s.side][s.index];
}

function writeSlot<P extends EditableRound>(p: P, s: Slot, id: MemberId): P {
  if (s.court === null) return { ...p, waiting: p.waiting.map((w, i) => (i === s.index ? id : w)) };
  const court = s.court;
  return {
    ...p,
    courts: p.courts.map((c, i) => (i === court ? { ...c, [s.side]: c[s.side].map((m, j) => (j === s.index ? id : m)) } : c)),
  };
}

/** Tukar dua pemain (antar tim, antar lapangan, atau dengan yang menunggu). Slot sama → tidak berubah. */
export function swapSlots<P extends EditableRound>(p: P, x: Slot, y: Slot): P {
  if (sameSlot(x, y)) return p;
  const a = readSlot(p, x);
  const b = readSlot(p, y);
  return writeSlot(writeSlot(p, x, b), y, a);
}

/**
 * Pindahkan susunan di lapangan `from` ke lapangan `to`. Bila `to` sudah berisi susunan lain, keduanya bertukar lapangan.
 * `to` harus salah satu lapangan kosong (`allowed`); selain itu tidak berubah. Hasil diurutkan menurut nomor lapangan.
 */
export function moveLineup<P extends EditableRound>(p: P, from: number, to: number, allowed: readonly number[]): P {
  if (from === to || !allowed.includes(to) || !p.courts.some((c) => c.courtNo === from)) return p;
  const courts = p.courts
    .map((c) => (c.courtNo === from ? { ...c, courtNo: to } : c.courtNo === to ? { ...c, courtNo: from } : c))
    .sort((x, y) => x.courtNo - y.courtNo);
  return { ...p, courts };
}
