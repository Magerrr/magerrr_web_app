import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyLink } from "@/components/copy-link";
import { NoAccess } from "@/components/no-access";
import { PointBadge } from "@/components/point-badge";
import { MyTurn, WaitingList } from "@/components/waiting-list";
import { Badge, ButtonLink, Card, Notice, Page, TopBar } from "@/components/ui";
import { pointStatus } from "@/lib/core/scoring";
import { getGroup } from "@/lib/db/groups";
import type { SessionMatch } from "@/lib/db/matches";
import { publicEnv } from "@/lib/env";
import { loadPlay, waitingView } from "@/lib/db/play";
import { getSession, lastShuttlePrice } from "@/lib/db/sessions";
import { getTournament, tournamentTag } from "@/lib/db/tournaments";
import { formatShortDateId } from "@/lib/format";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../../access";
import { STATUS_LABEL, STATUS_TONE } from "../../status";
import { VoidButton, WakeLock } from "./board-tools";
import { LiveCourt } from "./live-court";
import { PairsEditor } from "./pairs-editor";
import { RoundPlanner } from "./round-planner";
import { ShuttleCounter } from "./shuttle-counter";
import { teamLabel, type Names } from "./types";

export const metadata: Metadata = { title: "Papan skor" };

export default async function PlayPage({ params }: PageProps<"/g/[groupId]/sesi/[sessionId]/main">) {
  const { groupId, sessionId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/sesi/${sessionId}/main`} />;
  const { member, via } = access.membership;
  const isAdmin = member.role === "admin" && via === "account";

  const [group, session] = await Promise.all([getGroup(groupId), isUuid(sessionId) ? getSession(groupId, sessionId) : null]);
  const back = `/g/${groupId}/sesi/${sessionId}`;
  if (!session) {
    return (
      <Page>
        <TopBar back={`/g/${groupId}`} title={group.name} />
        <Card>
          <h1 className="text-sub">Sesi tidak ditemukan</h1>
        </Card>
      </Page>
    );
  }

  const [ctx, defaultShuttlePrice, tournament] = await Promise.all([
    loadPlay(group, session),
    isAdmin ? lastShuttlePrice(groupId) : null,
    getTournament(session.id),
  ]);
  /** "Turnamen · Semifinal 1" / "Turnamen · Grup A" untuk match yang tertaut ke turnamen */
  const tagOf = (m: (typeof ctx.matches)[number]) => tournamentTag(tournament, m);
  const flatShuttle = session.expenses.filter((e) => e.preset === "shuttle").reduce((sum, e) => sum + e.amount, 0);
  const names: Names = Object.fromEntries(ctx.members.map((m) => [m.id, m.display_name]));
  const running = session.status === "running";
  const rotation = session.playMode === "rotasi";
  const canScore = isAdmin && running;
  const waiting = waitingView(ctx, new Date());
  const myCourt = ctx.running.find((m) => m.players.A.includes(member.id) || m.players.B.includes(member.id))?.courtNo ?? null;
  const history = ctx.matches.filter((m) => m.status !== "running").reverse();
  const matchUrl = (id: string) => `/api/groups/${groupId}/sessions/${sessionId}/matches/${id}`;
  const hasAside = canScore || (running && (session.shuttle.used > 0 || waiting.length > 0));

  return (
    <Page width="wide">
      <TopBar back={back} title={`${formatShortDateId(session.startsAt)}${session.venue ? ` · ${session.venue}` : ""}`} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[session.status]}>{STATUS_LABEL[session.status]}</Badge>
          <Badge>{rotation ? "Rotasi · kalah keluar" : "Kocok pasangan"}</Badge>
          <Badge>
            {ctx.rules.target} poin · {ctx.gamesMax === 1 ? "1 game" : `best of ${ctx.gamesMax}`}
          </Badge>
        </div>
        <h1 className="text-title">Papan skor</h1>
        {canScore && <WakeLock />}
        {running && !canScore && <AutoRefresh />}
        {session.status !== "finished" && (
          <CopyLink url={`${publicEnv().siteUrl}/s/${session.shareToken}/skor`} label="Salin tautan skor langsung" done="Tautan skor langsung disalin. Bagikan ke grup; bisa dibuka tanpa login." />
        )}
      </div>

      {session.status === "planned" && (
        <Notice>{isAdmin ? "Mulai sesi dulu di halaman sesi untuk mencatat skor." : "Sesi belum dimulai."}</Notice>
      )}
      {running && <MyTurn entries={waiting} courtNo={myCourt} viewerId={member.id} rotation={rotation} />}

      {/* Desktop: lapangan & riwayat di kiri; kok & antrian di kolom kanan. Ponsel: urutan DOM. */}
      <div
        className={
          hasAside
            ? "flex flex-col gap-6 @panel:grid @panel:grid-cols-[minmax(0,1fr)_22rem] @panel:grid-rows-[auto_1fr] @panel:items-start @panel:gap-x-8"
            : "flex flex-col gap-6"
        }
      >
        <div className="flex min-w-0 flex-col gap-6 @panel:col-start-1 @panel:row-start-1">
          {session.playMode === "fix_pasangan" && (
            <PairsEditor
              url={`/api/groups/${groupId}/sessions/${sessionId}/pairs`}
              pairs={session.fixedPairs ?? []}
              present={ctx.present}
              names={names}
              editable={isAdmin && session.status !== "finished"}
            />
          )}

          <section aria-label="Lapangan" className={`grid gap-4 ${session.courtCount > 1 ? "md:grid-cols-2" : ""}`}>
            {Array.from({ length: session.courtCount }, (_, i) => i + 1).map((courtNo) => {
              const match = ctx.running.find((m) => m.courtNo === courtNo);
              if (match && canScore) {
                return (
                  <LiveCourt
                    key={match.id}
                    groupId={groupId}
                    sessionId={sessionId}
                    courtNo={courtNo}
                    match={{ id: match.id, kind: match.kind, players: match.players, games: match.games, rules: match.rules, gamesMax: match.gamesMax }}
                    names={names}
                    rotation={rotation && match.tournament === null}
                    tag={tagOf(match)}
                  />
                );
              }
              return (
                <Card key={courtNo} className="flex flex-col gap-2" data-testid={`court-${courtNo}`}>
                  <h3 className="text-lead">Lapangan {courtNo}</h3>
                  {match && tagOf(match) && <p className="text-small">{tagOf(match)}</p>}
                  {match ? (
                    <>
                      <p className="text-ui">
                        {teamLabel(match.players.A, names)} <strong className="font-medium">{match.games.at(-1)?.a}–{match.games.at(-1)?.b}</strong>{" "}
                        {teamLabel(match.players.B, names)}
                      </p>
                      <PointBadges match={match} names={names} />
                    </>
                  ) : (
                    <p className="text-small">Kosong</p>
                  )}
                </Card>
              );
            })}
          </section>

          {tournament && (
            <ButtonLink href={`/g/${groupId}/sesi/${sessionId}/turnamen?tab=jadwal`} variant="secondary" size="lg" className="sm:w-auto sm:self-start sm:px-8">
              Jadwal turnamen
            </ButtonLink>
          )}

          {canScore && ctx.emptyCourts.length > 0 && (
            <RoundPlanner
              groupId={groupId}
              sessionId={sessionId}
              rotation={rotation}
              fixed={session.playMode === "fix_pasangan"}
              rotationStarted={session.rotationQueue !== null}
              emptyCourts={ctx.emptyCourts.length}
              availableCount={ctx.present.filter((id) => !ctx.onCourt.has(id)).length}
              names={names}
            />
          )}
        </div>

        {hasAside && (
          <div className="flex min-w-0 flex-col gap-6 @panel:col-start-2 @panel:row-span-2 @panel:row-start-1">
            {canScore ? (
              <ShuttleCounter
                url={`/api/groups/${groupId}/sessions/${sessionId}/shuttle`}
                initial={session.shuttle}
                defaultPrice={defaultShuttlePrice}
                flatShuttle={flatShuttle > 0 ? flatShuttle : null}
              />
            ) : (
              running &&
              session.shuttle.used > 0 && (
                <p className="text-ui" data-testid="shuttles-used">
                  Kok terpakai: {session.shuttle.used}
                </p>
              )
            )}

            {running && waiting.length > 0 && <WaitingList entries={waiting} names={names} rotation={rotation} viewerId={member.id} />}
          </div>
        )}

        <section aria-labelledby="riwayat-match" className="flex min-w-0 flex-col gap-3 @panel:col-start-1">
          <div className="flex items-center justify-between gap-3">
            <h2 id="riwayat-match" className="text-sub">
              Match ({history.filter((m) => m.status === "completed").length})
            </h2>
            {isAdmin && session.status !== "planned" && (
              <ButtonLink href={`/g/${groupId}/sesi/${sessionId}/catat`} variant="secondary">
                Catat manual
              </ButtonLink>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-small">Belum ada match selesai.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2" data-testid="match-history">
              {history.map((m) => (
                <li key={m.id} className={`rounded-2xl border px-4 py-3 ${m.status === "void" ? "border-sandstone bg-sandstone" : "border-ink-black bg-pure-white"}`}>
                  <div className="flex items-baseline justify-between gap-2 text-small">
                    <span>
                      #{m.order}
                      {m.courtNo ? ` · Lapangan ${m.courtNo}` : ""} · {m.kind === "doubles" ? "Ganda" : "Tunggal"}
                      {tagOf(m) ? ` · ${tagOf(m)}` : ""}
                    </span>
                    {m.status === "void" && <Badge tone="muted">Dibatalkan</Badge>}
                  </div>
                  <div className={`mt-1 grid grid-cols-[1fr_auto] gap-x-3 text-ui ${m.status === "void" ? "line-through" : ""}`}>
                    {(["A", "B"] as const).map((side) => (
                      <div key={side} className="contents">
                        <span className={m.winner === side ? "font-medium" : ""}>
                          {m.winner === side && (
                            <>
                              <span aria-hidden="true">▸ </span>
                              <span className="sr-only">Pemenang: </span>
                            </>
                          )}
                          {teamLabel(m.players[side], names)}
                        </span>
                        <span className="tabular-nums">
                          {m.games.map((g) => (side === "A" ? g.a : g.b)).join("  ")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {isAdmin && m.status === "completed" && (
                    <div className="mt-1 flex gap-4">
                      <Link href={`/g/${groupId}/sesi/${sessionId}/catat/${m.id}`} className="flex min-h-11 items-center px-1 text-small underline underline-offset-4">
                        Ubah skor
                      </Link>
                      <VoidButton url={`${matchUrl(m.id)}/void`} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}

function PointBadges({ match, names }: { match: SessionMatch; names: Names }) {
  const points = pointStatus(match.games, match.rules, { games: match.gamesMax });
  if (!points.A && !points.B) return null;
  return (
    <p className="flex flex-wrap gap-2">
      <PointBadge kind={points.A} who={teamLabel(match.players.A, names)} />
      <PointBadge kind={points.B} who={teamLabel(match.players.B, names)} />
    </p>
  );
}
