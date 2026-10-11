// Maskot Kiko: level dari XP, suasana dari streak mingguan, kostum yang terbuka per level.
// ALGORITHMS.md belum mendefinisikan maskot; aturan di bawah dicatat di docs/DECISIONS.md.
// Semua diturunkan dari match & kehadiran setiap kali dibuka — tidak ada XP yang disimpan.
//  - XP = 100 per sesi yang dihadiri (sesi sudah dimulai) + 10 per match selesai + 10 per kemenangan.
//  - Streak = minggu (Senin–Minggu, WIB) berturut-turut dengan minimal satu sesi dihadiri; minggu ini
//    yang belum ada sesinya tidak memutus streak.
import type { MatchRecord, MemberId } from "./types";

export const KIKO_XP = { session: 100, match: 10, win: 10 } as const;

export type KikoLevel = 1 | 2 | 3 | 4;

export const KIKO_LEVELS: readonly { level: KikoLevel; name: string; minXp: number }[] = [
  { level: 1, name: "Anak Kucing", minXp: 0 },
  { level: 2, name: "Kucing Muda", minXp: 500 },
  { level: 3, name: "Atlet", minXp: 1000 },
  { level: 4, name: "Juara", minXp: 1500 },
];

export interface XpBreakdown {
  sessions: number;
  matches: number;
  wins: number;
  xp: number;
}

/** XP anggota dari match selesai (ganda & tunggal) dan jumlah sesi yang dihadirinya. */
export function memberXp(matches: MatchRecord[], memberId: MemberId, attendedSessions: number): XpBreakdown {
  if (!Number.isInteger(attendedSessions) || attendedSessions < 0) throw new RangeError("jumlah sesi harus bilangan bulat ≥ 0");
  let played = 0;
  let wins = 0;
  for (const m of matches) {
    if (m.status !== "completed" || m.winner === null) continue;
    const side = m.players.A.includes(memberId) ? "A" : m.players.B.includes(memberId) ? "B" : null;
    if (!side) continue;
    played++;
    if (m.winner === side) wins++;
  }
  return {
    sessions: attendedSessions,
    matches: played,
    wins,
    xp: attendedSessions * KIKO_XP.session + played * KIKO_XP.match + wins * KIKO_XP.win,
  };
}

export interface LevelProgress {
  level: KikoLevel;
  name: string;
  xp: number;
  /** level berikutnya; null = sudah level tertinggi */
  next: { level: KikoLevel; name: string; minXp: number } | null;
  /** 0…1 menuju level berikutnya (1 di level tertinggi) */
  ratio: number;
}

export function levelProgress(xp: number): LevelProgress {
  if (!Number.isInteger(xp) || xp < 0) throw new RangeError("XP harus bilangan bulat ≥ 0");
  const index = KIKO_LEVELS.findLastIndex((l) => xp >= l.minXp);
  const current = KIKO_LEVELS[index];
  const next = KIKO_LEVELS[index + 1] ?? null;
  return {
    level: current.level,
    name: current.name,
    xp,
    next,
    ratio: next ? (xp - current.minXp) / (next.minXp - current.minXp) : 1,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
// 1970-01-01 hari Kamis; Senin pertama = 5 Januari (4 hari kemudian).
const MONDAY_OFFSET_MS = 4 * DAY_MS;

/** Nomor minggu (Senin–Minggu, WIB) sejak 5 Januari 1970. */
export function jakartaWeek(date: Date): number {
  return Math.floor((date.getTime() + WIB_OFFSET_MS - MONDAY_OFFSET_MS) / (7 * DAY_MS));
}

/**
 * Minggu berturut-turut dengan minimal satu sesi dihadiri, dihitung mundur dari minggu `today`.
 * Bila minggu ini belum ada sesi, hitungan mulai dari minggu lalu (streak belum putus sampai minggu berganti).
 * Sesi setelah `today` diabaikan.
 */
export function weeklyStreak(sessionDates: Date[], today: Date): number {
  const now = jakartaWeek(today);
  const weeks = new Set(sessionDates.filter((d) => d.getTime() <= today.getTime()).map(jakartaWeek));
  let week = weeks.has(now) ? now : now - 1;
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week--;
  }
  return streak;
}

export type KikoMood = "sleepy" | "happy" | "fire";

/** 0 minggu → ngantuk, 1–3 → semangat, 4+ → membara. */
export function kikoMood(streak: number): KikoMood {
  return streak <= 0 ? "sleepy" : streak < 4 ? "happy" : "fire";
}

// Kostum disimpan sebagai kunci (bukan warna bebas); warna digambar di komponen.
export const KIKO_FUR = ["oranye", "abu", "krem", "hitam"] as const;
export const KIKO_HAT = ["none", "band", "cap", "crown"] as const;
export const KIKO_ACC = ["none", "ball", "racket", "shades"] as const;
export const KIKO_JERSEY = ["none", "navy", "hijau", "koral", "hitam"] as const;

export interface KikoOutfit {
  fur: (typeof KIKO_FUR)[number];
  hat: (typeof KIKO_HAT)[number];
  acc: (typeof KIKO_ACC)[number];
  jersey: (typeof KIKO_JERSEY)[number];
}

export type OutfitPart = keyof KikoOutfit;

/** Level minimal untuk memakai tiap pilihan kostum. */
export const KIKO_UNLOCK: { [P in OutfitPart]: Record<KikoOutfit[P], KikoLevel> } = {
  fur: { oranye: 1, abu: 1, krem: 1, hitam: 1 },
  hat: { none: 1, band: 2, cap: 3, crown: 4 },
  acc: { none: 1, ball: 2, racket: 3, shades: 3 },
  jersey: { none: 1, navy: 3, hijau: 3, koral: 3, hitam: 3 },
};

export function isUnlocked<P extends OutfitPart>(part: P, value: KikoOutfit[P], level: KikoLevel): boolean {
  return KIKO_UNLOCK[part][value] <= level;
}

/** Kostum otomatis per level (ikat kepala Lv 2, jersey & raket Lv 3, mahkota Lv 4). */
export function defaultOutfit(level: KikoLevel): KikoOutfit {
  return {
    fur: "oranye",
    hat: level >= 4 ? "crown" : level >= 2 ? "band" : "none",
    acc: level >= 3 ? "racket" : "none",
    jersey: level >= 3 ? "navy" : "none",
  };
}

/**
 * Kostum yang ditampilkan: pilihan tersimpan bila sah dan sudah terbuka di level sekarang, selain itu
 * kostum otomatis level itu (mis. level turun karena match dibatalkan). `saved` null = otomatis.
 */
export function resolveOutfit(saved: Partial<Record<OutfitPart, unknown>> | null, level: KikoLevel): KikoOutfit {
  const auto = defaultOutfit(level);
  if (!saved) return auto;
  const pick = <P extends OutfitPart>(part: P): KikoOutfit[P] => {
    const value = saved[part];
    const options = KIKO_UNLOCK[part] as Record<string, KikoLevel>;
    return typeof value === "string" && Object.hasOwn(options, value) && options[value] <= level ? (value as KikoOutfit[P]) : auto[part];
  };
  return { fur: pick("fur"), hat: pick("hat"), acc: pick("acc"), jersey: pick("jersey") };
}
