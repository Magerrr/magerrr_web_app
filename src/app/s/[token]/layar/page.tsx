import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { cx } from "@/components/button-class";
import { SERVICE_COURT_LABEL, ShuttleIcon } from "@/components/shuttle-icon";
import { servePosition } from "@/lib/core/scoring";
import { getGroup } from "@/lib/db/groups";
import type { SessionMatch } from "@/lib/db/matches";
import { loadPlay } from "@/lib/db/play";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { DisplayTools } from "./display-tools";

export const metadata: Metadata = { title: "Papan skor layar penuh", robots: { index: false, follow: false } };

const chipClass = (active: boolean) =>
  cx(
    "inline-flex min-h-11 items-center rounded-full border px-4 text-ui transition-colors",
    active ? "border-fresh-grass bg-fresh-grass text-ink-black" : "border-cream-paper hover:bg-fresh-grass hover:text-ink-black",
  );

function CourtBoard({ courtNo, match, names }: { courtNo: number; match: SessionMatch | undefined; names: Record<string, string> }) {
  const headingId = `layar-lapangan-${courtNo}`;
  return (
    <section aria-labelledby={headingId} data-testid={`display-court-${courtNo}`} className="@container flex flex-col gap-[min(2cqw,2vh)] rounded-3xl bg-pure-ink p-[min(4cqw,4vh)]">
      <h2 id={headingId} className="text-[min(5cqw,6vh)] leading-tight">
        Lapangan {courtNo}
      </h2>
      {match ? <Scoreboard match={match} names={names} /> : <p className="py-[min(8cqw,8vh)] text-center text-[min(6cqw,7vh)]">Kosong</p>}
    </section>
  );
}

/** Satu baris per tim: nama pemain di kiri, posisi kok saat servis (ALGORITHMS §1e), skor game berjalan di kanan. */
function Scoreboard({ match, names }: { match: SessionMatch; names: Record<string, string> }) {
  const game = match.games.at(-1) ?? { a: 0, b: 0 };
  const leading = game.a === game.b ? null : game.a > game.b ? "A" : "B";
  const serve = servePosition(match.games, match.serving, match.rules, { games: match.gamesMax });

  return (
    <div className="flex flex-col">
      {(["A", "B"] as const).map((s) => (
        <div
          key={s}
          data-testid={`display-team-${s}`}
          className="grid grid-cols-[minmax(0,1fr)_min(12cqw,14vh)_auto] items-center gap-x-[min(3cqw,3vh)] border-t border-ink-black py-[min(2cqw,2vh)] first:border-t-0"
        >
          <ul className="flex min-w-0 flex-col text-[min(6cqw,7vh)] leading-tight">
            {match.players[s].map((id) => (
              <li key={id} className="truncate">
                {names[id] ?? "?"}
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center">
            {serve?.side === s && (
              <>
                <ShuttleIcon className="size-[min(8cqw,9vh)] text-sunshine-pop" />
                <span className="text-[min(2.6cqw,3vh)]" data-testid="display-serve">
                  Servis {SERVICE_COURT_LABEL[serve.court]}
                </span>
              </>
            )}
          </div>
          <span
            data-testid={`display-score-${s}`}
            className={cx(
              "min-w-[1.2em] text-right text-[min(18cqw,22vh)] leading-none font-medium tracking-[-0.06em] tabular-nums",
              leading === s ? "text-fresh-grass" : "text-cream-paper",
            )}
          >
            {s === "A" ? game.a : game.b}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Papan skor layar penuh untuk TV/tablet di samping lapangan: hanya nomor lapangan, nama pemain, dan skor. Publik lewat token sesi (sama dengan skor langsung),
 * `?lapangan=N` untuk satu lapangan.
 */
export default async function DisplayPage({ params, searchParams }: PageProps<"/s/[token]/layar">) {
  const { token } = await params;
  const query = await searchParams;
  const session = await findSessionByShareToken(token);
  if (!session) notFound();
  const ctx = await loadPlay(await getGroup(session.groupId), session);
  const names = Object.fromEntries(ctx.members.map((m) => [m.id, m.display_name]));
  const running = session.status === "running";
  const courts = Array.from({ length: session.courtCount }, (_, i) => i + 1);
  const picked = Number(query.lapangan);
  const only = courts.includes(picked) ? picked : null;
  const shown = only === null ? courts : [only];
  const href = (court: number | null) => `/s/${token}/layar${court === null ? "" : `?lapangan=${court}`}`;

  return (
    <main id="konten" className="flex min-h-dvh flex-col gap-4 bg-ink-black p-4 text-cream-paper sm:p-6 [&_*:focus-visible]:outline-fresh-grass">
      <h1 className="sr-only">Papan skor</h1>
      {/* Kontrol tersembunyi saat layar penuh: yang tampil hanya lapangan, nama, dan skor. */}
      <div className="flex flex-wrap items-start justify-between gap-3 [:fullscreen_&]:hidden">
        {running && courts.length > 1 ? (
          <nav aria-label="Pilih lapangan" className="flex flex-wrap gap-2">
            <Link href={href(null)} className={chipClass(only === null)} aria-current={only === null ? "page" : undefined}>
              Semua
            </Link>
            {courts.map((n) => (
              <Link key={n} href={href(n)} className={chipClass(only === n)} aria-current={only === n ? "page" : undefined}>
                Lapangan {n}
              </Link>
            ))}
          </nav>
        ) : (
          <span />
        )}
        <DisplayTools />
      </div>

      {running ? (
        <div className={cx("grid flex-1 content-center gap-4", shown.length > 1 && "lg:grid-cols-2")}>
          {shown.map((courtNo) => {
            const match = ctx.running.find((m) => m.courtNo === courtNo);
            return <CourtBoard key={courtNo} courtNo={courtNo} match={match} names={names} />;
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

      <div className="flex flex-wrap items-center justify-between gap-2 [:fullscreen_&]:hidden">
        {running ? <AutoRefresh /> : <span />}
        <Link href={`/s/${token}/skor`} className="inline-flex min-h-11 items-center text-small underline underline-offset-4">
          Tampilan biasa
        </Link>
      </div>
    </main>
  );
}
