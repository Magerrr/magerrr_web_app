import type { SessionStatus } from "@/lib/core/session";
import { PLAY_MODES } from "@/lib/validation";

export const STATUS_LABEL: Record<SessionStatus, string> = {
  planned: "Rencana",
  running: "Berlangsung",
  finished: "Selesai",
};

export const STATUS_TONE = { planned: "neutral", running: "accent", finished: "muted" } as const;

export const PLAY_MODE_LABEL = {
  kocok: "Kocok pasangan",
  rotasi: "Rotasi (kalah keluar)",
  fix_pasangan: "Pasangan tetap",
  round_robin: "Round robin",
} as const;

export type OfferedPlayMode = (typeof PLAY_MODES)[number];

/** Pilihan mode di form; mode yang belum ditawarkan (round_robin) jatuh ke kocok. */
export const toOfferedMode = (mode: string): OfferedPlayMode =>
  (PLAY_MODES as readonly string[]).includes(mode) ? (mode as OfferedPlayMode) : "kocok";

export const PLAY_MODE_OPTIONS = PLAY_MODES.map((value) => ({ value, label: PLAY_MODE_LABEL[value] }));
