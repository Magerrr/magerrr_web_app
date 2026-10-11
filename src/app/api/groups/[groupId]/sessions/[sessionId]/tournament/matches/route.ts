import { readJson, route } from "@/lib/api";
import { getTournament, startTournamentMatch } from "@/lib/db/tournaments";
import { HttpError } from "@/lib/http-error";
import { tournamentStartSchema } from "@/lib/validation";
import { adminPlay } from "../../load";

/** Mulai satu match turnamen (slot bagan / pasangan grup) di lapangan kosong; skor dicatat di papan skor seperti match lain. */
export const POST = route<RouteContext<"/api/groups/[groupId]/sessions/[sessionId]/tournament/matches">>(async (request, { params }) => {
  const { groupId, sessionId } = await params;
  const { ctx, actorId } = await adminPlay(groupId, sessionId);
  const tournament = await getTournament(ctx.session.id);
  if (!tournament) throw new HttpError(404, "Turnamen tidak ditemukan.");
  const id = await startTournamentMatch(ctx, actorId, tournament, await readJson(request, tournamentStartSchema));
  return Response.json({ id }, { status: 201 });
});
