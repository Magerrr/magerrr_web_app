// Status sesi (PRD S4): planned → running → finished.

export type SessionStatus = "planned" | "running" | "finished";

/** Minimal pemain untuk satu match tunggal. */
export const MIN_PLAYERS_TO_START = 2;

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function checkTransition(from: SessionStatus, to: SessionStatus, presentCount: number): TransitionCheck {
  if (from === "finished") return { ok: false, reason: "Sesi sudah selesai." };
  if (from === "planned" && to === "running") {
    return presentCount >= MIN_PLAYERS_TO_START
      ? { ok: true }
      : { ok: false, reason: `Tandai minimal ${MIN_PLAYERS_TO_START} peserta hadir sebelum mulai.` };
  }
  if (from === "running" && to === "finished") return { ok: true };
  return { ok: false, reason: "Perubahan status ini tidak diizinkan." };
}
