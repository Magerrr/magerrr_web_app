// Peran anggota grup dan siapa yang ikut bermain (MAGERRR-11).

export type MemberRole = "admin" | "referee" | "member";

/** Wasit mengurus permainan saja: tidak masuk peserta, kocok, klasemen, atau patungan. */
export const canPlay = (role: MemberRole): boolean => role !== "referee";

/** Anggota yang boleh jadi peserta sesi, urutan asli dipertahankan. */
export const playersOf = <T extends { role: MemberRole }>(members: readonly T[]): T[] => members.filter((m) => canPlay(m.role));
