// Tipe dasar logika inti (docs/ALGORITHMS.md §0). Uang selalu integer rupiah.

export type Side = "A" | "B";
export type Rupiah = number;
export type MemberId = string;
export type MatchKind = "doubles" | "singles";
export type MatchStatus = "running" | "completed" | "void";

export interface GameScore {
  a: number;
  b: number;
}

export interface Teams {
  A: MemberId[];
  B: MemberId[];
}

/** Satu match seperti yang dibaca dari DB (matches + match_players + games + sessions). */
export interface MatchRecord {
  id: string;
  sessionId: string;
  seasonId?: string | null;
  sessionDate: Date;
  /** matches.seq — urutan di dalam sesi */
  order: number;
  kind: MatchKind;
  status: MatchStatus;
  players: Teams;
  games: GameScore[];
  winner: Side | null;
}

/** Urutan id deterministik (code unit), tidak bergantung locale. */
export function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function otherSide(side: Side): Side {
  return side === "A" ? "B" : "A";
}
