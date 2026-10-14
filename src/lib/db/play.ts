import "server-only";
import { assertValidPairs, autoPairs, fixedContext, pairKey, planFixedRound, type Pair } from "@/lib/core/fixed";
import { kocokContext, planRound, type Grade, type PlanHint } from "@/lib/core/kocok";
import { matchMinutes, restingPriority, rotationTurns, turnEta } from "@/lib/core/queue";
import { afterGame, fillCourt, isWaiting, reconcileQueue, startRotation } from "@/lib/core/rotation";
import { checkGames, type GameRules } from "@/lib/core/rules";
import { canScore, scorerRefusal, type ScorerActor } from "@/lib/core/scorer";
import type { GameScore, MatchKind, MemberId, Side, Teams } from "@/lib/core/types";
import { HttpError } from "@/lib/http-error";
import type { MatchResultInput, StartRoundInput } from "@/lib/validation";
import type { Member } from "./authz";
import type { Json } from "./database.types";
import type { GroupSettings } from "./groups";
import { loadGroupMatches, loadSessionMatches, type SessionMatch } from "./matches";
import { listMembers } from "./members";
import { setFixedPairs, type SessionDetail } from "./sessions";
import { serviceClient } from "./supabase";

export interface Lineup extends Teams {
  courtNo: number;
  kind: MatchKind;
}

export interface Proposal {
  mode: "kocok" | "rotasi" | "fix_pasangan";
  kind: MatchKind;
  courts: Lineup[];
  /** kocok: istirahat (prioritas main berikutnya); rotasi: antrian */
  waiting: MemberId[];
  hint?: PlanHint;
  seed: number | null;
}

export interface PlayContext {
  session: SessionDetail;
  group: GroupSettings;
  members: Member[];
  matches: SessionMatch[];
  running: SessionMatch[];
  onCourt: Set<MemberId>;
  emptyCourts: number[];
  /** peserta hadir, urut nama (urutan awal rotasi & penambahan antrian) */
  present: MemberId[];
  rules: GameRules;
  gamesMax: 1 | 3 | 5;
  /** pencatat skor per nomor lapangan (ALGORITHMS §1d); lapangan tanpa entri = admin */
  scorers: Record<number, MemberId>;
}

async function loadScorers(sessionId: string): Promise<Record<number, MemberId>> {
  const { data, error } = await serviceClient().from("court_scorers").select("court_no, member_id").eq("session_id", sessionId);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.court_no, r.member_id]));
}

export async function loadPlay(group: GroupSettings, session: SessionDetail): Promise<PlayContext> {
  const [members, matches, scorers] = await Promise.all([listMembers(group.id), loadSessionMatches(session, group), loadScorers(session.id)]);
  const running = matches.filter((m) => m.status === "running");
  const onCourt = new Set(running.flatMap((m) => [...m.players.A, ...m.players.B]));
  const busyCourts = new Set(running.map((m) => m.courtNo));
  const presentSet = new Set(session.presentIds);
  return {
    session,
    group,
    members,
    matches,
    running,
    onCourt,
    emptyCourts: Array.from({ length: session.courtCount }, (_, i) => i + 1).filter((n) => !busyCourts.has(n)),
    present: members
      .filter((m) => presentSet.has(m.id))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, "id"))
      .map((m) => m.id),
    rules: session.rules ?? group.rules,
    gamesMax: session.matchGames ?? group.matchGames,
    scorers,
  };
}

/** Pencatat skor lapangan `courtNo`, atau null (admin). */
export const scorerOf = (ctx: PlayContext, courtNo: number | null): MemberId | null => (courtNo === null ? null : (ctx.scorers[courtNo] ?? null));

/** Tolak (403) bila `actor` tidak memegang skor lapangan match ini (ALGORITHMS §1d). */
export function assertCanScore(ctx: PlayContext, actor: ScorerActor, matchId: string): void {
  const match = ctx.running.find((m) => m.id === matchId);
  // Match yang sudah selesai/dibatalkan ditolak dengan 409 oleh pemanggil (runningMatch).
  if (!match) return;
  const scorer = scorerOf(ctx, match.courtNo);
  if (canScore(scorer, actor)) return;
  const name = ctx.members.find((m) => m.id === scorer)?.display_name;
  throw new HttpError(403, scorer ? `Skor lapangan ini sedang dipegang ${name ?? "pemain lain"}. Muat ulang halaman.` : "Hanya admin grup yang boleh mencatat skor lapangan ini.");
}

const SCORER_REFUSAL = {
  not_present: "Pencatat skor harus peserta yang hadir di sesi ini.",
  taken: "Lapangan ini sudah punya pencatat skor. Minta admin bila ingin ganti.",
  not_allowed: "Hanya admin yang bisa menunjuk atau mengganti pencatat skor.",
} as const;

/** Tunjuk / ajukan diri / lepas pencatat skor lapangan (ALGORITHMS §1d). */
export async function setCourtScorer(ctx: PlayContext, actor: ScorerActor, courtNo: number, next: MemberId | null): Promise<MemberId | null> {
  assertRunning(ctx);
  if (courtNo > ctx.session.courtCount) throw new HttpError(422, "Nomor lapangan tidak valid.");
  const current = scorerOf(ctx, courtNo);
  const refusal = scorerRefusal(current, next, actor, ctx.present);
  if (refusal) throw new HttpError(refusal === "not_present" ? 422 : refusal === "taken" ? 409 : 403, SCORER_REFUSAL[refusal]);
  if (next === current) return next;
  const table = serviceClient().from("court_scorers");
  const key = { session_id: ctx.session.id, court_no: courtNo };
  if (next === null) {
    // Pemain hanya melepas baris miliknya sendiri (bisa saja sudah diganti admin sesaat sebelumnya).
    const query = table.delete().match(key);
    const { error } = actor.isAdmin ? await query : await query.eq("member_id", actor.id);
    if (error) throw error;
    return null;
  }
  if (actor.isAdmin) {
    const { error } = await table.upsert({ ...key, member_id: next, assigned_at: new Date().toISOString() });
    if (error) throw error;
    return next;
  }
  // Mengajukan diri: insert biasa, sehingga dua pemain yang menekan bersamaan tidak saling menimpa.
  const { error } = await table.insert({ ...key, member_id: next });
  if (error?.code === "23505") throw new HttpError(409, SCORER_REFUSAL.taken);
  if (error) throw error;
  return next;
}

const isRotation = (ctx: PlayContext) => ctx.session.playMode === "rotasi";

/**
 * Urutan pemain dalam satu tim tidak disimpan (kunci match_players = match + anggota), jadi urutan hasil query
 * tidak bisa dipakai. Pemain yang kalah masuk antrian menurut urutan peserta (nama), sama dengan susunan awal
 * rotasi (ALGORITHMS §4.1 langkah 2: urutan pemain kalah dipertahankan), supaya antrian deterministik.
 */
function inPresentOrder(ctx: PlayContext, teams: Teams): Teams {
  const rank = new Map(ctx.present.map((id, i) => [id, i]));
  const order = (ids: MemberId[]) => [...ids].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
  return { A: order(teams.A), B: order(teams.B) };
}
const isFixed = (ctx: PlayContext) => ctx.session.playMode === "fix_pasangan";

/** Rating tiap pemain (grade atau win rate ganda all-time), sama dengan kocok. */
export async function memberRatings(ctx: PlayContext, ids: MemberId[]): Promise<Map<MemberId, number>> {
  const grades = new Map(ctx.members.map((m) => [m.id, m.grade as Grade | null]));
  const { players } = kocokContext({
    candidates: ids.map((id) => ({ id, grade: grades.get(id) ?? null })),
    sessionMatches: ctx.matches,
    groupMatches: await loadGroupMatches(ctx.group.id),
  });
  return new Map(players.map((p) => [p.id, p.rating]));
}

/** Pasangan tetap sesi: otomatis (seimbang menurut rating) atau manual; semua anggota pasangan harus hadir. */
export async function savePairs(ctx: PlayContext, input: { auto: true } | { pairs: Pair[] }): Promise<{ pairs: Pair[]; unpaired: MemberId[] }> {
  if (!isFixed(ctx)) throw new HttpError(422, "Sesi ini tidak memakai mode pasangan tetap.");
  let pairs: Pair[];
  if ("auto" in input) {
    const rated = await memberRatings(ctx, ctx.present);
    pairs = autoPairs(ctx.present.map((id) => ({ id, rating: rated.get(id) ?? 0 }))).pairs;
  } else {
    pairs = input.pairs;
    try {
      assertValidPairs(pairs);
    } catch (error) {
      throw new HttpError(422, (error as Error).message);
    }
    const present = new Set(ctx.present);
    if (pairs.flat().some((id) => !present.has(id))) throw new HttpError(422, "Pasangan hanya dari peserta yang hadir.");
  }
  await setFixedPairs(ctx.session, pairs);
  const paired = new Set(pairs.flat());
  return { pairs, unpaired: ctx.present.filter((id) => !paired.has(id)) };
}
const sideSize = (kind: MatchKind) => (kind === "doubles" ? 2 : 1);
const sameMembers = (x: MemberId[], y: MemberId[]) => x.length === y.length && x.every((id) => y.includes(id));

function assertRunning(ctx: PlayContext): void {
  if (ctx.session.status !== "running") throw new HttpError(422, "Mulai sesi dulu sebelum mencatat skor.");
}

/** Usulan susunan untuk semua lapangan kosong (belum disimpan). */
export async function proposeRound(ctx: PlayContext, kind: MatchKind, seed: number): Promise<Proposal> {
  assertRunning(ctx);
  if (ctx.emptyCourts.length === 0) throw new HttpError(422, "Semua lapangan sedang dipakai.");
  const available = ctx.present.filter((id) => !ctx.onCourt.has(id));

  if (isRotation(ctx)) {
    let courts: Lineup[] = [];
    let queue: MemberId[];
    if (ctx.session.rotationQueue === null) {
      const start = startRotation(available, ctx.emptyCourts.length, kind);
      courts = start.courts.map((t, i) => ({ ...t, courtNo: ctx.emptyCourts[i], kind }));
      queue = start.queue;
    } else {
      queue = reconcileQueue(ctx.session.rotationQueue, ctx.present, [...ctx.onCourt]);
      for (const courtNo of ctx.emptyCourts) {
        const filled = fillCourt(queue, kind);
        if (!filled.teams) break;
        courts.push({ ...filled.teams, courtNo, kind });
        queue = filled.queue;
      }
    }
    const hint: PlanHint | undefined =
      courts.length > 0 ? undefined : kind === "doubles" && available.length >= 2 ? "bisa tunggal" : "kurang pemain";
    return { mode: "rotasi", kind, courts, waiting: queue, hint, seed: null };
  }

  if (isFixed(ctx)) {
    if (kind !== "doubles") throw new HttpError(422, "Mode pasangan tetap hanya untuk ganda.");
    const pairs = (ctx.session.fixedPairs ?? []).filter(([a, b]) => available.includes(a) && available.includes(b));
    if ((ctx.session.fixedPairs ?? []).length === 0) throw new HttpError(422, "Atur pasangan tetap dulu.");
    const rated = await memberRatings(ctx, pairs.flat());
    const { states, opponentCount } = fixedContext({ pairs, ratings: rated, sessionMatches: ctx.matches });
    const plan = planFixedRound({ pairs: states, courts: ctx.emptyCourts.length, opponentCount }, seed);
    const paired = new Set(pairs.flat());
    return {
      mode: "fix_pasangan",
      kind,
      courts: plan.courts.map((t, i) => ({ ...t, courtNo: ctx.emptyCourts[i], kind })),
      // pasangan yang istirahat (urut prioritas), lalu pemain tanpa pasangan
      waiting: [...plan.resting.flat(), ...available.filter((id) => !paired.has(id))],
      hint: plan.hint,
      seed,
    };
  }

  const grades = new Map(ctx.members.map((m) => [m.id, m.grade as Grade | null]));
  const { players, history } = kocokContext({
    candidates: available.map((id) => ({ id, grade: grades.get(id) ?? null })),
    sessionMatches: ctx.matches,
    groupMatches: await loadGroupMatches(ctx.group.id),
  });
  const plan = planRound({ players, courts: ctx.emptyCourts.length, format: kind, history }, seed);
  return {
    mode: "kocok",
    kind,
    courts: plan.courts.map((t, i) => ({ ...t, courtNo: ctx.emptyCourts[i], kind })),
    waiting: plan.resting,
    hint: plan.hint,
    seed,
  };
}

/** Pemain sah: hadir, tidak sedang main, tidak dobel, jumlah per sisi sesuai jenis match. */
function validateTeams(kind: MatchKind, teams: Teams, allowed: Set<MemberId>, used: Set<MemberId>): void {
  const size = sideSize(kind);
  if (teams.A.length !== size || teams.B.length !== size) {
    throw new HttpError(422, kind === "doubles" ? "Ganda butuh 2 pemain per sisi." : "Tunggal butuh 1 pemain per sisi.");
  }
  for (const id of [...teams.A, ...teams.B]) {
    if (!allowed.has(id)) throw new HttpError(422, "Ada pemain yang tidak hadir atau sedang main di lapangan lain.");
    if (used.has(id)) throw new HttpError(422, "Satu pemain tidak boleh ada di dua tempat sekaligus.");
    used.add(id);
  }
}

export function dbError(error: { code?: string; message: string }): never {
  if (error.code === "23505" && /matches_one_per_(bracket_slot|entry_pair)/.test(error.message)) {
    throw new HttpError(409, "Match turnamen ini sudah dimulai. Muat ulang halaman.");
  }
  if (error.code === "23505") throw new HttpError(409, "Lapangan sudah dipakai. Muat ulang halaman.");
  if (error.message.includes("match_not_running")) throw new HttpError(409, "Match sudah selesai atau dibatalkan. Muat ulang halaman.");
  if (error.message.includes("match_not_found")) throw new HttpError(404, "Match tidak ditemukan.");
  if (error.message.includes("match_void")) throw new HttpError(422, "Match yang dibatalkan tidak bisa diubah.");
  throw error;
}

const asJson = (value: unknown) => value as Json;

export async function startRound(ctx: PlayContext, actorId: string, input: StartRoundInput): Promise<string[]> {
  assertRunning(ctx);
  const allowed = new Set(ctx.present.filter((id) => !ctx.onCourt.has(id)));
  const used = new Set<MemberId>();
  const courts = new Set<number>();
  for (const m of input.matches) {
    if (!ctx.emptyCourts.includes(m.courtNo) || courts.has(m.courtNo)) {
      throw new HttpError(409, `Lapangan ${m.courtNo} tidak kosong. Muat ulang halaman.`);
    }
    courts.add(m.courtNo);
    validateTeams(m.kind, m, allowed, used);
    if (isFixed(ctx)) {
      const keys = new Set((ctx.session.fixedPairs ?? []).map(pairKey));
      if (m.kind !== "doubles" || !keys.has(pairKey(m.A as Pair)) || !keys.has(pairKey(m.B as Pair))) {
        throw new HttpError(422, "Mode pasangan tetap: setiap sisi harus salah satu pasangan tetap.");
      }
    }
  }
  const queue = isRotation(ctx)
    ? reconcileQueue(input.queue ?? ctx.session.rotationQueue ?? [], ctx.present, [...ctx.onCourt, ...used])
    : null;
  const { data, error } = await serviceClient(actorId).rpc("start_matches", {
    p_session: ctx.session.id,
    p_matches: asJson(
      input.matches.map((m) => ({
        kind: m.kind,
        court_no: m.courtNo,
        players: { A: m.A, B: m.B },
        rules: ctx.rules,
        games_max: ctx.gamesMax,
      })),
    ),
    p_seed: isRotation(ctx) ? (null as unknown as number) : (input.seed as number),
    p_queue: queue as string[],
  });
  if (error) dbError(error);
  return data;
}

function runningMatch(ctx: PlayContext, matchId: string): SessionMatch {
  const match = ctx.running.find((m) => m.id === matchId);
  if (!match) throw new HttpError(409, "Match sudah selesai atau dibatalkan. Muat ulang halaman.");
  return match;
}

export async function saveLiveScore(ctx: PlayContext, matchId: string, games: GameScore[], serving: Side | null): Promise<void> {
  const match = runningMatch(ctx, matchId);
  checkGames(games, match.rules, { games: match.gamesMax }, { complete: false });
  const { error } = await serviceClient().rpc("set_live_score", { p_match: match.id, p_games: asJson(games), p_serving: serving as string });
  if (error) dbError(error);
}

/** Selesaikan match berjalan. Mode rotasi: pemenang tetap, yang kalah antre, penantang masuk (§4.1). */
export async function completeMatch(ctx: PlayContext, actorId: string, matchId: string, games: GameScore[]): Promise<void> {
  const match = runningMatch(ctx, matchId);
  const winner = checkGames(games, match.rules, { games: match.gamesMax }, { complete: true })!;
  let next: object | null = null;
  let queue: MemberId[] | null = null;
  // Match turnamen tidak memutar antrian rotasi: lawan berikutnya ditentukan jadwal turnamen.
  if (isRotation(ctx) && match.courtNo !== null && match.tournament === null) {
    const busy = [...ctx.onCourt];
    const state = afterGame(
      { courts: [inPresentOrder(ctx, match.players)], queue: reconcileQueue(ctx.session.rotationQueue ?? [], ctx.present, busy) },
      0,
      winner,
    );
    queue = state.queue;
    if (!isWaiting(state.courts[0])) {
      next = { kind: match.kind, court_no: match.courtNo, players: state.courts[0], rules: match.rules, games_max: match.gamesMax };
    }
  }
  const { error } = await serviceClient(actorId).rpc("record_result", {
    p_session: ctx.session.id,
    p_match: match.id,
    p_result: asJson({ kind: match.kind, court_no: match.courtNo, players: match.players, games, winner }),
    p_next: asJson(next),
    p_queue: queue as string[],
  });
  if (error) dbError(error);
}

/** Input skor akhir manual (SC11) atau edit hasil match yang sudah selesai (SC7). */
export async function saveResult(ctx: PlayContext, actorId: string, input: MatchResultInput, matchId?: string): Promise<string> {
  const existing = matchId ? ctx.matches.find((m) => m.id === matchId) : undefined;
  if (matchId && (!existing || existing.status !== "completed")) {
    throw new HttpError(422, "Hanya match yang sudah selesai yang bisa diedit di sini.");
  }
  const teams = { A: input.A, B: input.B };
  validateTeams(input.kind, teams, new Set(ctx.session.presentIds), new Set());
  if (existing?.tournament && !(sameMembers(existing.players.A, teams.A) && sameMembers(existing.players.B, teams.B))) {
    throw new HttpError(422, "Pemain match turnamen mengikuti jadwal turnamen dan tidak bisa diubah. Ubah skornya saja.");
  }
  const rules = existing?.rules ?? ctx.rules;
  const gamesMax = existing?.gamesMax ?? ctx.gamesMax;
  const winner = checkGames(input.games, rules, { games: gamesMax }, { complete: true });
  const { data, error } = await serviceClient(actorId).rpc("record_result", {
    p_session: ctx.session.id,
    p_match: (matchId ?? null) as string,
    p_result: asJson({
      kind: input.kind,
      court_no: input.courtNo,
      players: teams,
      games: input.games,
      winner,
      rules,
      games_max: gamesMax,
    }),
    p_next: asJson(null),
    p_queue: null as unknown as string[],
  });
  if (error) dbError(error);
  return data;
}

/** Batalkan match (tidak dihitung). Rotasi: pemain match berjalan yang dibatalkan kembali ke ujung antrian. */
export async function voidMatch(ctx: PlayContext, actorId: string, matchId: string): Promise<void> {
  const match = ctx.matches.find((m) => m.id === matchId);
  if (!match) throw new HttpError(404, "Match tidak ditemukan.");
  let queue: MemberId[] | null = null;
  if (isRotation(ctx) && match.status === "running" && ctx.session.rotationQueue !== null) {
    const { A, B } = inPresentOrder(ctx, match.players);
    queue = [...reconcileQueue(ctx.session.rotationQueue, ctx.present, [...ctx.onCourt]), ...A, ...B];
  }
  const { error } = await serviceClient(actorId).rpc("void_match", {
    p_session: ctx.session.id,
    p_match: match.id,
    p_queue: queue as string[],
  });
  if (error) dbError(error);
}

export interface WaitingEntry {
  /** satu pemain, atau dua untuk pasangan tetap */
  ids: MemberId[];
  /** match selesai di sesi ini */
  played: number;
  /** rotasi: 0 = masuk saat game berikutnya selesai; null = mode lain */
  turn: number | null;
  /** rotasi: perkiraan menit sampai masuk; null bila belum ada data durasi */
  etaMin: number | null;
}

const MINUTE = 60_000;

/** Antrian giliran (SC9, ALGORITHMS §4.4): yang menunggu, urut giliran / prioritas kocok. */
export function waitingView(ctx: PlayContext, now: Date): WaitingEntry[] {
  const available = ctx.present.filter((id) => !ctx.onCourt.has(id));
  const done = ctx.matches.filter((m) => m.status === "completed");
  const played = (id: MemberId) => done.filter((m) => m.players.A.includes(id) || m.players.B.includes(id)).length;

  if (isRotation(ctx)) {
    const queue = ctx.session.rotationQueue === null ? available : reconcileQueue(ctx.session.rotationQueue, ctx.present, [...ctx.onCourt]);
    const courts = ctx.running.filter((m) => m.tournament === null && m.courtNo !== null);
    // Belum ada lapangan rotasi berjalan → antrian belum bergerak; jenis dari match terakhir.
    const kind = (courts[0] ?? ctx.matches.findLast((m) => m.status !== "void"))?.kind ?? "doubles";
    const turns = rotationTurns(queue, kind);
    const avg = matchMinutes(done.flatMap((m) => (m.completedAt ? [(m.completedAt.getTime() - m.startedAt.getTime()) / MINUTE] : [])));
    const eta = turnEta(
      courts.map((m) => Math.max(0, (now.getTime() - m.startedAt.getTime()) / MINUTE)),
      avg,
      (turns.at(-1) ?? -1) + 1,
    );
    return queue.map((id, i) => ({ ids: [id], played: played(id), turn: courts.length > 0 ? turns[i] : null, etaMin: eta[turns[i]] ?? null }));
  }

  const { players } = kocokContext({ candidates: available.map((id) => ({ id, grade: null })), sessionMatches: ctx.matches, groupMatches: [] });
  if (isFixed(ctx)) {
    const pairs = (ctx.session.fixedPairs ?? []).filter(([a, b]) => available.includes(a) && available.includes(b));
    const paired = new Set(pairs.flat());
    const { states } = fixedContext({ pairs, ratings: new Map(), sessionMatches: ctx.matches });
    return [
      ...restingPriority(states).map((p) => ({ ids: [...p.members], played: p.playedThisSession, turn: null, etaMin: null })),
      ...restingPriority(players.filter((p) => !paired.has(p.id))).map((p) => ({ ids: [p.id], played: p.playedThisSession, turn: null, etaMin: null })),
    ];
  }
  return restingPriority(players).map((p) => ({ ids: [p.id], played: p.playedThisSession, turn: null, etaMin: null }));
}
