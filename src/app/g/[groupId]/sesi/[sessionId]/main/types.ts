import type { GameRules } from "@/lib/core/rules";
import type { GameScore, MatchKind, MatchStatus, Side, Teams } from "@/lib/core/types";

export interface LiveMatchView {
  id: string;
  kind: MatchKind;
  players: Teams;
  games: GameScore[];
  rules: GameRules;
  gamesMax: 1 | 3 | 5;
  /** pihak yang servis (ALGORITHMS §1e) */
  serving: Side | null;
}

export interface CourtView {
  courtNo: number;
  match: LiveMatchView | null;
}

export interface HistoryView {
  id: string;
  seq: number;
  kind: MatchKind;
  courtNo: number | null;
  status: MatchStatus;
  winner: Side | null;
  players: Teams;
  games: GameScore[];
}

export type Names = Record<string, string>;

export const teamLabel = (ids: string[], names: Names) => ids.map((id) => names[id] ?? "?").join(" / ");
