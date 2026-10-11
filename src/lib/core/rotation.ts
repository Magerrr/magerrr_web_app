// Mode `rotasi` — kalah keluar (docs/ALGORITHMS.md §4.1). PRD: SC9, SC10b.
import { otherSide, type MatchKind, type MemberId, type Side, type Teams } from "./types";

export interface RotationState {
  courts: Teams[];
  /** antrian FIFO bersama untuk semua lapangan */
  queue: MemberId[];
}

const sideSizeOf = (kind: MatchKind) => (kind === "doubles" ? 2 : 1);

/** Lapangan menunggu bila salah satu sisi kosong (antrian tidak cukup). */
export function isWaiting(court: Teams): boolean {
  return court.A.length === 0 || court.B.length === 0;
}

function assertUnique(players: MemberId[]): void {
  if (new Set(players).size !== players.length) throw new RangeError("pemain ganda dalam daftar");
}

/**
 * Susunan awal: isi lapangan berurutan dari daftar pemain, sisanya antre.
 * Hanya lapangan yang bisa terisi penuh yang dibuat.
 */
export function startRotation(players: MemberId[], courtCount: number, kind: MatchKind): RotationState {
  assertUnique(players);
  const size = sideSizeOf(kind);
  const courts: Teams[] = [];
  let next = 0;
  while (courts.length < courtCount && players.length - next >= size * 2) {
    courts.push({ A: players.slice(next, next + size), B: players.slice(next + size, next + size * 2) });
    next += size * 2;
  }
  return { courts, queue: players.slice(next) };
}

/** Setelah game di lapangan `courtIdx` selesai: pemenang tetap, yang kalah ke ujung antrian. */
export function afterGame(state: RotationState, courtIdx: number, winner: Side): RotationState {
  const court = state.courts[courtIdx];
  if (!court) throw new RangeError(`lapangan ${courtIdx} tidak ada`);
  if (isWaiting(court)) throw new RangeError(`lapangan ${courtIdx} sedang menunggu pemain`);

  const sideSize = court[winner].length;
  const q = [...state.queue, ...court[otherSide(winner)]];
  const enough = q.length >= sideSize;
  const challengers = enough ? q.slice(0, sideSize) : [];
  const stays = [...court[winner]];
  const next: Teams = winner === "A" ? { A: stays, B: challengers } : { A: challengers, B: stays };

  return {
    courts: state.courts.map((c, i) => (i === courtIdx ? next : c)),
    queue: enough ? q.slice(sideSize) : q,
  };
}

/**
 * Sesuaikan antrian dengan kehadiran: buang yang tidak hadir atau sedang main (dan duplikat),
 * lalu tambahkan peserta hadir yang belum ada di ujung, mengikuti urutan `present`.
 */
export function reconcileQueue(queue: MemberId[], present: MemberId[], onCourt: MemberId[]): MemberId[] {
  const presentSet = new Set(present);
  const busy = new Set(onCourt);
  const result: MemberId[] = [];
  for (const id of [...queue, ...present]) {
    if (presentSet.has(id) && !busy.has(id) && !result.includes(id)) result.push(id);
  }
  return result;
}

/** Isi lapangan kosong dari kepala antrian; null bila antrian kurang dari dua sisi. */
export function fillCourt(queue: MemberId[], kind: MatchKind): { teams: Teams | null; queue: MemberId[] } {
  const size = sideSizeOf(kind);
  if (queue.length < size * 2) return { teams: null, queue: [...queue] };
  return { teams: { A: queue.slice(0, size), B: queue.slice(size, size * 2) }, queue: queue.slice(size * 2) };
}
