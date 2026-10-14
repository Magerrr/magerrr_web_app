import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { cx } from "@/components/button-class";
import { courtEnds } from "@/lib/core/scoring";
import type { Side } from "@/lib/core/types";
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

function CourtBoard({ courtNo, match, names, swap }: { courtNo: number; match: SessionMatch | undefined; names: Record<string, string>; swap: boolean }) {
  const headingId = `layar-lapangan-${courtNo}`;
  return (
    <section aria-labelledby={headingId} data-testid={`display-court-${courtNo}`} className="@container flex flex-col gap-[min(3cqw,3vh)] rounded-3xl bg-pure-ink p-[min(4cqw,4vh)]">
      <h2 id={headingId} className="text-center text-[min(6cqw,7vh)] leading-tight">
        Lapangan {courtNo}
      </h2>
      {match ? <Scoreboard match={match} names={names} swap={swap} /> : <p className="py-[min(8cqw,8vh)] text-center text-[min(6cqw,7vh)]">Kosong</p>}
    </section>
  );
}

/** Dua sisi berdampingan: nama pemain di atas skor game berjalan; kiri–kanan mengikuti ganti sisi (ALGORITHMS §1c). */
function Scoreboard({ match, names, swap }: { match: SessionMatch; names: Record<string, string>; swap: boolean }) {
  const ends = courtEnds(match.games, match.rules, { games: match.gamesMax });
  const left: Side = swap ? (ends === "A" ? "B" : "A") : ends;
  const right: Side = left === "A" ? "B" : "A";
  const game = match.games.at(-1) ?? { a: 0, b: 0 };
  const leading = game.a === game.b ? null : game.a > game.b ? "A" : "B";

  const side = (s: Side, position: "left" | "right") => (
    <div data-testid={`display-side-${position}`} className="flex min-w-0 flex-col items-center gap-[min(2cqw,2vh)]">
      <ul className="flex w-full flex-col items-center text-center text-[min(5cqw,6vh)] leading-tight">
        {match.players[s].map((id) => (
          <li key={id} className="w-full truncate">
            {names[id] ?? "?"}
          </li>
        ))}
      </ul>
      <span
        data-testid={`display-score-${s}`}
        className={cx("text-[min(24cqw,38vh)] leading-none font-medium tracking-[-0.06em] tabular-nums", leading === s ? "text-fresh-grass" : "text-cream-paper")}
      >
        {s === "A" ? game.a : game.b}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 items-start gap-[min(4cqw,4vh)]">
      {side(left, "left")}
      {side(right, "right")}
    </div>
  );
}

/**
 * Papan skor layar penuh untuk TV/tablet di samping lapangan: hanya nomor lapangan, nama pemain, dan skor. Publik lewat token sesi (sama dengan skor langsung),
 * `?lapangan=N` untuk satu lapangan, `?tukar=1` menukar kiri–kanan agar sesuai posisi layar terhadap lapangan.
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
  const swap = query.tukar === "1";
  const shown = only === null ? courts : [only];
  const href = (court: number | null, tukar: boolean) => {
    const params = new URLSearchParams();
    if (court !== null) params.set("lapangan", String(court));
    if (tukar) params.set("tukar", "1");
    const search = params.toString();
    return `/s/${token}/layar${search ? `?${search}` : ""}`;
  };

  return (
    <main id="konten" className="flex min-h-dvh flex-col gap-4 bg-ink-black p-4 text-cream-paper sm:p-6 [&_*:focus-visible]:outline-fresh-grass">
      <h1 className="sr-only">Papan skor</h1>
      {/* Kontrol tersembunyi saat layar penuh: yang tampil hanya lapangan, nama, dan skor. */}
      <div className="flex flex-wrap items-start justify-between gap-3 [:fullscreen_&]:hidden">
        {running ? (
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
        ) : (
          <span />
        )}
        <DisplayTools />
      </div>

      {running ? (
        <div className={cx("grid flex-1 content-center gap-4", shown.length > 1 && "lg:grid-cols-2")}>
          {shown.map((courtNo) => {
            const match = ctx.running.find((m) => m.courtNo === courtNo);
            return <CourtBoard key={courtNo} courtNo={courtNo} match={match} names={names} swap={swap} />;
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
