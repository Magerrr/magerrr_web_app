import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card, Page, Split, textLinkClass } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { loadPlay, waitingList } from "@/lib/db/play";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { getTournament } from "@/lib/db/tournaments";
import { formatDateId, formatTimeRangeId } from "@/lib/format";

export const metadata: Metadata = { title: "Skor langsung", robots: { index: false, follow: false } };

const STATUS = { planned: "Belum dimulai", running: "Berlangsung", finished: "Selesai" } as const;

/** Live scoreboard publik (PRD SC8): penonton tanpa login, auto-refresh selama sesi berlangsung. */
export default async function LiveScorePage({ params }: PageProps<"/s/[token]/skor">) {
  const { token } = await params;
  const session = await findSessionByShareToken(token);
  if (!session) notFound();
  const group = await getGroup(session.groupId);
  const [ctx, tournament] = await Promise.all([loadPlay(group, session), getTournament(session.id)]);
  const names = Object.fromEntries(ctx.members.map((m) => [m.id, m.display_name]));
  const team = (ids: string[]) => ids.map((id) => names[id] ?? "?").join(" / ");
  const running = session.status === "running";
  const waiting = running ? waitingList(ctx) : [];
  const recent = ctx.matches.filter((m) => m.status === "completed").reverse().slice(0, 5);

  const others =
    waiting.length > 0 || recent.length > 0 ? (
      <>
        {waiting.length > 0 && (
          <section aria-labelledby="berikutnya" className="flex flex-col gap-2">
            <h2 id="berikutnya" className="text-sub">
              {session.playMode === "rotasi" ? "Antrian berikutnya" : "Istirahat"}
            </h2>
            <ol className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white">
              {waiting.map((id, i) => (
                <li key={id} className="flex min-h-11 items-center gap-3 px-4 text-ui">
                  <span className="w-6 tabular-nums">{i + 1}</span>
                  {names[id] ?? "?"}
                </li>
              ))}
            </ol>
          </section>
        )}

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
      <div className="flex flex-col gap-2">
        <p className="text-small">{group.name}</p>
        <h1 className="text-title">Skor langsung</h1>
        <p className="text-ui">
          {formatDateId(session.startsAt)} · {formatTimeRangeId(session.startsAt, session.durationMin)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={running ? "accent" : "neutral"}>{STATUS[session.status]}</Badge>
        </div>
        {running && <AutoRefresh />}
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
                return (
                  <Card key={courtNo} className="flex flex-col gap-3" data-testid={`live-court-${courtNo}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-lead">Lapangan {courtNo}</h2>
                      {match && match.gamesMax > 1 && <p className="text-small">Game {match.games.length} · best of {match.gamesMax}</p>}
                    </div>
                    {match && game ? (
                      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
                        <span className="text-ui">{team(match.players.A)}</span>
                        <span className="text-title tabular-nums" data-testid="live-score-A">
                          {game.a}
                        </span>
                        <span className="text-ui">{team(match.players.B)}</span>
                        <span className="text-title tabular-nums" data-testid="live-score-B">
                          {game.b}
                        </span>
                      </div>
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
