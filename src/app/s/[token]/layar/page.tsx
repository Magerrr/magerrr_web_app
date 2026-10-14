import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { cx } from "@/components/button-class";
import { CourtView } from "@/components/court-view";
import { gameWinner } from "@/lib/core/rules";
import { courtEnds, pointStatus, type PointKind } from "@/lib/core/scoring";
import type { Side } from "@/lib/core/types";
import { getGroup } from "@/lib/db/groups";
import type { SessionMatch } from "@/lib/db/matches";
import { loadPlay, waitingView } from "@/lib/db/play";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { getTournament, tournamentTag } from "@/lib/db/tournaments";
import { DisplayTools } from "./display-tools";

export const metadata: Metadata = { title: "Papan skor layar penuh", robots: { index: false, follow: false } };

const chipClass = (active: boolean) =>
  cx(
    "inline-flex min-h-11 items-center rounded-full border px-4 text-ui transition-colors",
    active ? "border-fresh-grass bg-fresh-grass text-ink-black" : "border-cream-paper hover:bg-fresh-grass hover:text-ink-black",
  );

function PointPill({ kind }: { kind: PointKind | null }) {
  if (!kind) return <span className="h-[4.2cqw]" aria-hidden="true" />;
  return (
    <span className="rounded-full bg-sunshine-pop px-[1.6cqw] py-[0.4cqw] text-[2.4cqw] leading-tight text-ink-black uppercase">
      {kind === "match" ? "Match point" : "Game point"}
    </span>
  );
}

function CourtBoard({ courtNo, match, names, tag, swap }: { courtNo: number; match: SessionMatch | undefined; names: Record<string, string>; tag: string | null; swap: boolean }) {
  const headingId = `layar-lapangan-${courtNo}`;
  const nameList = (ids: string[]) => ids.map((id) => names[id] ?? "?");
  return (
    <section aria-labelledby={headingId} data-testid={`display-court-${courtNo}`} className="@container flex flex-col gap-[2cqw] rounded-3xl bg-pure-ink p-[3cqw]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id={headingId} className="text-[4.4cqw] leading-tight">
          Lapangan {courtNo}
        </h2>
        {match && (
          <p className="text-[2.6cqw]">
            {match.gamesMax > 1 ? `Game ${match.games.length} · best of ${match.gamesMax}` : `${match.rules.target} poin`}
            {tag ? ` · ${tag}` : ""}
          </p>
        )}
      </div>
      {match ? <Scoreboard match={match} nameList={nameList} swap={swap} /> : <p className="py-[6cqw] text-center text-[5cqw] text-cream-paper">Kosong</p>}
    </section>
  );
}

function Scoreboard({ match, nameList, swap }: { match: SessionMatch; nameList: (ids: string[]) => string[]; swap: boolean }) {
  const format = { games: match.gamesMax };
  const ends = courtEnds(match.games, match.rules, format);
  const left: Side = swap ? (ends === "A" ? "B" : "A") : ends;
  const right: Side = left === "A" ? "B" : "A";
  const game = match.games.at(-1) ?? { a: 0, b: 0 };
  const score = (side: Side) => (side === "A" ? game.a : game.b);
  const leading = game.a === game.b ? null : game.a > game.b ? "A" : "B";
  const points = pointStatus(match.games, match.rules, format);
  const wins = (side: Side) => match.games.filter((g) => gameWinner(g.a, g.b, match.rules) === side).length;
  const team = (side: Side) => nameList(match.players[side]).join(" / ");

  const block = (side: Side) => (
    <div className="flex min-w-0 flex-col items-center gap-[1cqw]">
      <span className="sr-only">{team(side)}: </span>
      <span
        data-testid={`display-score-${side}`}
        className={cx("text-[15cqw] leading-none font-medium tracking-[-0.06em] tabular-nums", leading === side ? "text-fresh-grass" : "text-cream-paper")}
      >
        {score(side)}
      </span>
      {match.gamesMax > 1 && <span className="text-[2.4cqw]">{wins(side)} game</span>}
      <PointPill kind={points[side]} />
    </div>
  );

  const history = match.games.slice(0, -1);
  return (
    <>
      <div className="grid grid-cols-[1fr_2.4fr_1fr] items-center gap-[2cqw]">
        {block(left)}
        <CourtView left={nameList(match.players[left])} right={nameList(match.players[right])} size="xl" />
        {block(right)}
      </div>
      {history.length > 0 && (
        <p className="text-center text-[2.6cqw] tabular-nums">
          {history.map((g, i) => `G${i + 1} ${left === "A" ? g.a : g.b}–${left === "A" ? g.b : g.a}`).join(" · ")}
        </p>
      )}
    </>
  );
}

/**
 * Papan skor layar penuh untuk TV/tablet di samping lapangan. Publik lewat token sesi (sama dengan skor langsung),
 * `?lapangan=N` untuk satu lapangan, `?tukar=1` menukar kiri–kanan agar sesuai posisi layar terhadap lapangan.
 */
export default async function DisplayPage({ params, searchParams }: PageProps<"/s/[token]/layar">) {
  const { token } = await params;
  const query = await searchParams;
  const session = await findSessionByShareToken(token);
  if (!session) notFound();
  const group = await getGroup(session.groupId);
  const [ctx, tournament] = await Promise.all([loadPlay(group, session), getTournament(session.id)]);
  const names = Object.fromEntries(ctx.members.map((m) => [m.id, m.display_name]));
  const running = session.status === "running";
  const courts = Array.from({ length: session.courtCount }, (_, i) => i + 1);
  const picked = Number(query.lapangan);
  const only = courts.includes(picked) ? picked : null;
  const swap = query.tukar === "1";
  const shown = only === null ? courts : [only];
  const waiting = running ? waitingView(ctx, new Date()) : [];
  const href = (court: number | null, tukar: boolean) => {
    const params = new URLSearchParams();
    if (court !== null) params.set("lapangan", String(court));
    if (tukar) params.set("tukar", "1");
    const search = params.toString();
    return `/s/${token}/layar${search ? `?${search}` : ""}`;
  };

  return (
    <main id="konten" className="flex min-h-dvh flex-col gap-4 bg-ink-black p-4 text-cream-paper sm:p-6 [&_*:focus-visible]:outline-fresh-grass">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-small">
            {group.name}
            {session.venue ? ` · ${session.venue}` : ""}
          </p>
          <h1 className="text-sub">Papan skor</h1>
        </div>
        {running && (
          <nav aria-label="Pilih lapangan" className="flex flex-wrap gap-2">
            {courts.length > 1 && (
              <Link href={href(null, swap)} className={chipClass(only === null)} aria-current={only === null ? "page" : undefined}>
                Semua
              </Link>
            )}
            {courts.length > 1 &&
              courts.map((n) => (
                <Link key={n} href={href(n, swap)} className={chipClass(only === n)} aria-current={only === n ? "page" : undefined}>
                  Lapangan {n}
                </Link>
              ))}
            <Link href={href(only, !swap)} className={chipClass(swap)}>
              {swap ? "Kembalikan kiri–kanan" : "Tukar kiri–kanan"}
            </Link>
          </nav>
        )}
        <DisplayTools />
      </header>

      {running ? (
        <div className={cx("grid flex-1 content-center gap-4", shown.length > 1 && "lg:grid-cols-2")}>
          {shown.map((courtNo) => {
            const match = ctx.running.find((m) => m.courtNo === courtNo);
            return <CourtBoard key={courtNo} courtNo={courtNo} match={match} names={names} tag={match ? tournamentTag(tournament, match) : null} swap={swap} />;
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-title">{session.status === "planned" ? "Sesi belum dimulai." : "Sesi sudah selesai."}</p>
          {session.status === "finished" && (
            <Link href={`/s/${token}/recap`} className={chipClass(false)}>
              Lihat recap sesi
            </Link>
          )}
        </div>
      )}

      {waiting.length > 0 && (
        <p className="text-lead" data-testid="display-waiting">
          <span className="text-fresh-grass">Menunggu giliran:</span> {waiting.slice(0, 8).map((w) => w.ids.map((id) => names[id] ?? "?").join(" / ")).join(" · ")}
          {waiting.length > 8 ? ` · +${waiting.length - 8}` : ""}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {running ? <AutoRefresh /> : <span />}
        <Link href={`/s/${token}/skor`} className="inline-flex min-h-11 items-center text-small underline underline-offset-4">
          Tampilan biasa
        </Link>
      </div>
    </main>
  );
}
