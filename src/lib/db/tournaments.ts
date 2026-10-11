import "server-only";
import { randomInt } from "node:crypto";
import { seedEntries, type Entry } from "@/lib/core/bracket";
import { assertValidPairs, autoPairs, type Pair } from "@/lib/core/fixed";
import {
  buildTournament,
  formatProblem,
  knockoutSize,
  linkLabel,
  schedule,
  snakeGroups,
  type GroupSetup,
  type LinkedMatch,
  type ScheduleItem,
  type TournamentFormat,
  type TournamentLink,
  type TournamentState,
} from "@/lib/core/tournament";
import type { MatchKind, MemberId } from "@/lib/core/types";
import { HttpError } from "@/lib/http-error";
import type { TournamentCreateInput, TournamentStartInput } from "@/lib/validation";
import type { Json } from "./database.types";
import type { SessionMatch } from "./matches";
import { dbError, memberRatings, type PlayContext } from "./play";
import { serviceClient } from "./supabase";

export interface Tournament {
  id: string;
  sessionId: string;
  name: string;
  kind: MatchKind;
  seeding: "rating" | "random";
  format: TournamentFormat;
  /** grup + gugur saja */
  groups: GroupSetup | null;
  entries: Entry[];
}

export interface TournamentView extends Tournament, TournamentState {
  /** jumlah babak bagan; 0 = tanpa bagan (round robin) */
  roundCount: number;
  /** semua match dalam urutan main (tanpa bye) */
  schedule: ScheduleItem[];
  /** lapangan tiap match turnamen (id match → nomor lapangan) */
  courtOf: Record<string, number | null>;
}

/** Turnamen sesi (paling banyak satu), atau null. Panggil hanya setelah cek akses sesi. */
export async function getTournament(sessionId: string): Promise<Tournament | null> {
  const { data, error } = await serviceClient()
    .from("tournaments")
    .select("id, session_id, name, kind, seeding, format, group_count, advance_count, tournament_entries(seed, player1, player2, group_no)")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    sessionId: data.session_id,
    name: data.name,
    kind: data.kind,
    seeding: data.seeding as Tournament["seeding"],
    format: data.format as TournamentFormat,
    groups: data.group_count !== null && data.advance_count !== null ? ({ count: data.group_count, advance: data.advance_count } as GroupSetup) : null,
    entries: [...data.tournament_entries]
      .sort((x, y) => x.seed - y.seed)
      .map((e) => ({
        seed: e.seed,
        players: e.player2 ? [e.player1, e.player2] : [e.player1],
        ...(e.group_no !== null ? { group: e.group_no - 1 } : {}),
      })),
  };
}

/** Match sesi yang tertaut ke turnamen (yang dibatalkan diabaikan). */
export function linkedMatches(matches: SessionMatch[], tournamentId: string): LinkedMatch[] {
  return matches.flatMap((m) =>
    m.tournament?.id === tournamentId && m.status !== "void"
      ? [{ link: m.tournament, matchId: m.id, status: m.status, players: m.players, games: m.games, winner: m.winner }]
      : [],
  );
}

export function tournamentView(tournament: Tournament, matches: SessionMatch[]): TournamentView {
  const state = buildTournament(tournament, linkedMatches(matches, tournament.id));
  const courtOf = Object.fromEntries(matches.filter((m) => m.tournament?.id === tournament.id).map((m) => [m.id, m.courtNo]));
  const size = knockoutSize(tournament, tournament.entries.length);
  return { ...tournament, ...state, roundCount: size ? Math.log2(size) : 0, schedule: schedule(state, tournament.format), courtOf };
}

/** "Turnamen · Semifinal 1" / "Turnamen · Grup A" untuk match yang tertaut ke turnamen ini; selain itu null. */
export function tournamentTag(tournament: Tournament | null, match: SessionMatch): string | null {
  if (!tournament || match.tournament?.id !== tournament.id) return null;
  return `Turnamen · ${linkLabel(tournament, match.tournament)}`;
}

/** Peserta dari input: tunggal per orang, ganda dipasangkan otomatis (seimbang) atau manual. */
async function entryTeams(ctx: PlayContext, input: TournamentCreateInput["entries"]): Promise<{ kind: MatchKind; teams: MemberId[][] }> {
  const present = new Set(ctx.present);
  const assertPresent = (ids: MemberId[]) => {
    if (new Set(ids).size !== ids.length) throw new HttpError(422, "Satu pemain hanya boleh terdaftar sekali.");
    if (ids.some((id) => !present.has(id))) throw new HttpError(422, "Peserta turnamen hanya dari peserta yang hadir di sesi ini.");
  };
  if (input.mode === "singles") {
    assertPresent(input.memberIds);
    return { kind: "singles", teams: input.memberIds.map((id) => [id]) };
  }
  if (input.mode === "pairs_auto") {
    assertPresent(input.memberIds);
    if (input.memberIds.length % 2 !== 0) throw new HttpError(422, "Jumlah pemain ganda harus genap. Tambah atau kurangi satu pemain.");
    const rated = await memberRatings(ctx, input.memberIds);
    return { kind: "doubles", teams: autoPairs(input.memberIds.map((id) => ({ id, rating: rated.get(id) ?? 0 }))).pairs };
  }
  try {
    assertValidPairs(input.pairs as Pair[]);
  } catch (error) {
    throw new HttpError(422, (error as Error).message);
  }
  assertPresent(input.pairs.flat());
  return { kind: "doubles", teams: input.pairs };
}

/** Buat turnamen + peserta ber-seed (dan ber-grup untuk grup + gugur), ter-audit. Panggil hanya setelah requireAdmin. */
export async function createTournament(ctx: PlayContext, actorId: string, input: TournamentCreateInput): Promise<string> {
  if (ctx.session.status === "finished") throw new HttpError(422, "Sesi sudah selesai.");
  const { kind, teams } = await entryTeams(ctx, input.entries);
  const problem = formatProblem(input.format, teams.length, input.groups);
  if (problem) throw new HttpError(422, problem);
  const rated = await memberRatings(ctx, teams.flat());
  const avg = (ids: MemberId[]) => ids.reduce((sum, id) => sum + (rated.get(id) ?? 0), 0) / ids.length;
  const entries = seedEntries(
    teams.map((players) => ({ players, rating: avg(players) })),
    input.seeding,
    randomInt(2_147_483_647),
  );
  const groupOf = input.groups ? snakeGroups(entries.length, input.groups.count) : null;
  const { data, error } = await serviceClient(actorId).rpc("create_tournament", {
    p_session: ctx.session.id,
    p_name: input.name,
    p_kind: kind,
    p_seeding: input.seeding,
    p_format: input.format,
    p_group_count: (input.groups?.count ?? null) as number,
    p_advance_count: (input.groups?.advance ?? null) as number,
    p_entries: entries.map((e, i) => [e.players[0], e.players[1] ?? null, groupOf ? groupOf[i] + 1 : null]) as Json,
    p_created_by: actorId,
  });
  if (error?.code === "23505") throw new HttpError(409, "Sesi ini sudah punya turnamen. Muat ulang halaman.");
  if (error) throw error;
  return data;
}

const sameLink = (x: TournamentLink, y: TournamentLink) =>
  x.stage === "knockout" ? y.stage === "knockout" && x.round === y.round && x.slot === y.slot : y.stage === "pool" && x.a === y.a && x.b === y.b;

/** Mulai satu match turnamen yang siap (slot bagan atau pasangan round robin / grup) di lapangan kosong. */
export async function startTournamentMatch(ctx: PlayContext, actorId: string, tournament: Tournament, input: TournamentStartInput): Promise<string> {
  if (ctx.session.status !== "running") throw new HttpError(422, "Mulai sesi dulu sebelum memulai match turnamen.");
  const link: TournamentLink = "round" in input ? { stage: "knockout", round: input.round, slot: input.slot } : { stage: "pool", a: input.a, b: input.b };
  const item = tournamentView(tournament, ctx.matches).schedule.find((i) => sameLink(i.link, link));
  if (!item) throw new HttpError(404, "Match turnamen tidak ditemukan.");
  if (item.state !== "ready" || item.a === null || item.b === null) {
    throw new HttpError(409, "Match ini belum bisa dimulai atau sudah dimainkan. Muat ulang halaman.");
  }
  if (!ctx.emptyCourts.includes(input.courtNo)) throw new HttpError(409, `Lapangan ${input.courtNo} tidak kosong. Muat ulang halaman.`);
  const players = { A: tournament.entries[item.a - 1].players, B: tournament.entries[item.b - 1].players };
  const present = new Set(ctx.present);
  for (const id of [...players.A, ...players.B]) {
    if (!present.has(id)) throw new HttpError(422, "Ada pemain turnamen yang tidak hadir di sesi ini.");
    if (ctx.onCourt.has(id)) throw new HttpError(409, "Ada pemain yang sedang main di lapangan lain. Tunggu match itu selesai.");
  }
  const { data, error } = await serviceClient(actorId).rpc("start_matches", {
    p_session: ctx.session.id,
    p_matches: [
      {
        kind: tournament.kind,
        court_no: input.courtNo,
        players,
        rules: ctx.rules,
        games_max: ctx.gamesMax,
        tournament_id: tournament.id,
        ...(link.stage === "knockout" ? { bracket_round: link.round, bracket_slot: link.slot } : { entry_a: link.a, entry_b: link.b }),
      },
    ] as unknown as Json,
    p_seed: null as unknown as number,
    p_queue: null as unknown as string[],
  });
  if (error) dbError(error);
  return data[0];
}

/** Hapus turnamen yang belum punya match berjalan / selesai (ter-audit). Panggil hanya setelah requireAdmin. */
export async function deleteTournament(actorId: string, tournamentId: string): Promise<void> {
  const { error } = await serviceClient(actorId).rpc("delete_tournament", { p_tournament: tournamentId });
  if (error?.message.includes("tournament_has_matches")) {
    throw new HttpError(422, "Turnamen sudah punya match. Batalkan dulu semua match turnamen di papan skor.");
  }
  if (error?.message.includes("tournament_not_found")) throw new HttpError(404, "Turnamen tidak ditemukan.");
  if (error) throw error;
}
