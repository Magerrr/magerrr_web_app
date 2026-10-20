import type { Metadata } from "next";
import { TrackOpen } from "@/components/track-open";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { CourtView } from "@/components/court-view";
import { SERVICE_COURT_LABEL, ShuttleIcon } from "@/components/shuttle-icon";
import { PointBadge } from "@/components/point-badge";
import { WaitingList } from "@/components/waiting-list";
import { Badge, Card, Page, Split, buttonClass, textLinkClass } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { loadPlay, waitingView } from "@/lib/db/play";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { getTournament } from "@/lib/db/tournaments";
import { courtEnds, pointStatus, servePosition } from "@/lib/core/scoring";
import { formatDateId, formatTimeRangeId } from "@/lib/format";

export const metadata: Metadata = { title: "Skor langsung", robots: { index: false, follow: false } };

const STATUS = { planned: "Belum dimulai", running: "Berlangsung", finished: "Selesai" } as const;
const STATUS_TONE = { planned: "sunshine", running: "live", finished: "muted" } as const;

/** Live scoreboard publik (PRD SC8): penonton tanpa login, auto-refresh selama sesi berlangsung. */
export default async function LiveScorePage({ params }: PageProps<"/s/[token]/skor">) {
  const { token } = await params;
  const session = await findSessionByShareToken(token);
  if (!session) notFound();
  const group = await getGroup(session.groupId);
  const [ctx, tournament] = await Promise.all([loadPlay(group, session), getTournament(session.id)]);
  const names = Object.fromEntries(ctx.members.map((m) => [m.id, m.display_name]));
  const team = (ids: string[]) => ids.map((id) => names[id] ?? "?").join(" / ");
  const nameList = (ids: string[]) => ids.map((id) => names[id] ?? "?");
  const running = session.status === "running";
  const waiting = running ? waitingView(ctx, new Date()) : [];
  const recent = ctx.matches.filter((m) => m.status === "completed").reverse().slice(0, 5);

  const others =
    waiting.length > 0 || recent.length > 0 ? (
      <>
        {waiting.length > 0 && <WaitingList entries={waiting} names={names} rotation={session.playMode === "rotasi"} />}

        {recent.length > 0 && (
          <section aria-labelledby="terakhir" className="flex flex-col gap-2">
            <h2 id="terakhir" className="text-sub">
              Hasil terakhir
            </h2>
            <ul className="flex flex-col gap-2" data-testid="live-recent">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-4 py-3 text-small">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={m.winner === "A" ? "font-medium" : ""}>{team(m.players.A)}</span>
                    <span className={m.winner === "B" ? "font-medium" : ""}>{team(m.players.B)}</span>
                  </span>
                  <span className="text-ui tabular-nums">{m.games.map((g) => `${g.a}–${g.b}`).join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    ) : null;

  return (
    <Page width="wide">
      <TrackOpen token={token} />
      <div className="flex flex-col gap-2">
        <p className="text-small">{group.name}</p>
        <h1 className="text-title">Skor langsung</h1>
        <p className="text-ui">
          {formatDateId(session.startsAt)} · {formatTimeRangeId(session.startsAt, session.durationMin)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[session.status]}>{STATUS[session.status]}</Badge>
        </div>
        {running && <AutoRefresh />}
        {session.status !== "finished" && (
          <a href={`/s/${token}/layar`} target="_blank" rel="noopener" className={buttonClass("secondary", "md", "self-start")}>
            Papan skor layar penuh<span className="sr-only"> (tab baru)</span>
          </a>
        )}
      </div>

      {session.status === "finished" && (
        <Link href={`/s/${token}/recap`} className={textLinkClass}>
          Lihat recap sesi
        </Link>
      )}
      {tournament && (
        <Link href={`/s/${token}/turnamen`} className={textLinkClass}>
          Turnamen: {tournament.name}
        </Link>
      )}

      {/* Desktop: lapangan di kiri, antrian & hasil terakhir di kolom kanan. */}
      {running ? (
        <Split
          main={
            <section aria-label="Lapangan" className={`grid gap-3 ${session.courtCount > 1 ? "sm:grid-cols-2" : ""}`}>
              {Array.from({ length: session.courtCount }, (_, i) => i + 1).map((courtNo) => {
                const match = ctx.running.find((m) => m.courtNo === courtNo);
                const game = match?.games.at(-1);
                const points = match ? pointStatus(match.games, match.rules, { games: match.gamesMax }) : null;
                const left = match ? courtEnds(match.games, match.rules, { games: match.gamesMax }) : "A";
                const right = left === "A" ? "B" : "A";
                const serve = match ? servePosition(match.games, match.serving, match.rules, { games: match.gamesMax }) : null;
                const serveBadge = (side: "A" | "B") =>
                  serve?.side === side && (
                    <span className="inline-flex items-center gap-1 text-small" data-testid="live-serve">
                      <ShuttleIcon className="size-5" />
                      Servis {SERVICE_COURT_LABEL[serve.court]}
                    </span>
                  );
                return (
                  <Card key={courtNo} className="flex flex-col gap-3" data-testid={`live-court-${courtNo}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-lead">Lapangan {courtNo}</h2>
                      {match && match.gamesMax > 1 && <p className="text-small">Game {match.games.length} · best of {match.gamesMax}</p>}
                    </div>
                    {match && game ? (
                      <>
                        <CourtView left={nameList(match.players[left])} right={nameList(match.players[right])} />
                        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
                          <span className="flex flex-wrap items-center gap-2 text-ui">
                            {team(match.players.A)} {serveBadge("A")} <PointBadge kind={points?.A ?? null} />
                          </span>
                          <span className="text-title tabular-nums" data-testid="live-score-A">
                            {game.a}
                          </span>
                          <span className="flex flex-wrap items-center gap-2 text-ui">
                            {team(match.players.B)} {serveBadge("B")} <PointBadge kind={points?.B ?? null} />
                          </span>
                          <span className="text-title tabular-nums" data-testid="live-score-B">
                            {game.b}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-small">Kosong</p>
                    )}
                  </Card>
                );
              })}
            </section>
          }
          aside={others}
        />
      ) : (
        others
      )}

      {session.status === "planned" && (
        <Card>
          <p className="text-ui">Sesi belum dimulai. Halaman ini akan menampilkan skor begitu host mulai mencatat.</p>
        </Card>
      )}
    </Page>
  );
}
