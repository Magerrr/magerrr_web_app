import { readJson, route } from "@/lib/api";
import { createTournament, deleteTournament, getTournament } from "@/lib/db/tournaments";
import { HttpError } from "@/lib/http-error";
import { tournamentCreateSchema } from "@/lib/validation";
import { adminPlay, adminSession } from "../load";

/** Buat turnamen (sistem gugur, round robin, grup + gugur) dari peserta hadir; seed dari rating atau acak. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/tournament">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { ctx, actorId } = await adminPlay(groupId, sessionId);
  const id = await createTournament(ctx, actorId, await readJson(request, tournamentCreateSchema));
  return Response.json({ id }, { status: 201 });
});

/** Hapus turnamen yang belum punya match dimainkan. */
export const DELETE = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/tournament">>(async (_request, { params }) => {
  const { groupId, sessionId } = await params;
  const { membership, session } = await adminSession(groupId, sessionId);
  const tournament = await getTournament(session.id);
  if (!tournament) throw new HttpError(404, "Turnamen tidak ditemukan.");
  await deleteTournament(membership.member.id, tournament.id);
  return new Response(null, { status: 204 });
});
