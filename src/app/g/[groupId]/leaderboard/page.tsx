import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LinkSelect } from "@/components/link-select";
import { NoAccess } from "@/components/no-access";
import { Card, Page, TopBar, textLinkClass } from "@/components/ui";
import {
  buildLeaderboard,
  champions,
  DEFAULT_PERIOD,
  defaultSeasonId,
  defaultSessionId,
  monthKey,
  monthsWithMatches,
  parseMonthKey,
  PERIOD_KEYS,
  toPeriod,
  type Leaderboard,
  type MonthRef,
  type PeriodKey,
} from "@/lib/core/leaderboard";
import { currentStreak, recentForm } from "@/lib/core/player";
import { inPeriod, jakartaMonth, type ScoringConfig, type StandingRow } from "@/lib/core/standings";
import type { MatchRecord } from "@/lib/core/types";
import { getGroup } from "@/lib/db/groups";
import { loadLeaderboardSources, type LeaderboardSources } from "@/lib/db/leaderboard";
import { formatMonthId, formatPercent, formatShortDateId, formatSigned, initials } from "@/lib/format";
import { pageAccess } from "../access";

export const metadata: Metadata = { title: "Leaderboard" };

type Tab = "klasemen" | "pasangan" | "form";
const TABS: { key: Tab; label: string }[] = [
  { key: "klasemen", label: "Klasemen" },
  { key: "pasangan", label: "Pasangan" },
  { key: "form", label: "Form" },
];
type Names = Record<string, string>;

const PERIOD_LABEL: Record<PeriodKey, string> = {
  sesi: "Sesi ini",
  bulan: "Bulan ini",
  musim: "Musim",
  semua: "All-time",
};

interface View {
  tab: Tab;
  periode: PeriodKey;
  sesi: string | null;
  bulan: MonthRef;
  musim: string | null;
}

function hrefFor(groupId: string, view: View): string {
  const q = new URLSearchParams();
  if (view.tab !== "klasemen") q.set("tab", view.tab);
  if (view.periode !== DEFAULT_PERIOD) q.set("periode", view.periode);
  if (view.periode === "sesi" && view.sesi) q.set("sesi", view.sesi);
  if (view.periode === "bulan") q.set("bulan", monthKey(view.bulan));
  if (view.periode === "musim" && view.musim) q.set("musim", view.musim);
  return `/g/${groupId}/leaderboard?${q}`;
}

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/g/[groupId]/leaderboard">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/leaderboard`} />;
  const { member, via } = access.membership;
  const isAdmin = member.role === "admin" && via === "account";

  const sp = await searchParams;
  const param = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  const [group, sources] = await Promise.all([getGroup(groupId), loadLeaderboardSources(groupId)]);

  const currentMonth = jakartaMonth(new Date());
  const view: View = {
    tab: TABS.find((t) => t.key === param("tab"))?.key ?? "klasemen",
    periode: (PERIOD_KEYS as readonly string[]).includes(param("periode")) ? (param("periode") as PeriodKey) : DEFAULT_PERIOD,
    sesi: sources.sessions.some((s) => s.id === param("sesi"))
      ? param("sesi")
      : defaultSessionId(sources.sessions, sources.matches),
    bulan: parseMonthKey(param("bulan")) ?? currentMonth,
    musim: sources.seasons.some((s) => s.id === param("musim")) ? param("musim") : defaultSeasonId(sources.seasons),
  };
  const period = toPeriod({ key: view.periode, sessionId: view.sesi, month: view.bulan, seasonId: view.musim });
  const season = sources.seasons.find((x) => x.id === view.musim) ?? null;
  const board = period ? buildLeaderboard(sources.matches, group.scoring, period, { me: member.id }) : null;
  const names: Names = sources.names;

  return (
    <Page width="wide">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <h1 className="text-title">Leaderboard</h1>

      {/* Desktop: jenis & periode berdampingan. */}
      <div className="flex flex-col gap-6 @panel:grid @panel:grid-cols-2 @panel:items-center @panel:gap-x-8">

        <nav aria-label="Jenis leaderboard" className="grid grid-cols-3 gap-1 rounded-2xl border border-ink-black bg-ink-black p-1">
          {TABS.map(({ key: tab, label }) => (
            <Link
              key={tab}
              href={hrefFor(groupId, { ...view, tab })}
              aria-current={view.tab === tab ? "page" : undefined}
              className={
                "flex min-h-11 items-center justify-center rounded-lg text-ui " +
                (view.tab === tab ? "bg-fresh-grass text-ink-black" : "text-cream-paper")
              }
            >
              {label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Periode" className="grid grid-cols-4 gap-2">
          {PERIOD_KEYS.map((periode) => (
            <Link
              key={periode}
              href={hrefFor(groupId, { ...view, periode, bulan: periode === "bulan" ? currentMonth : view.bulan })}
              aria-current={view.periode === periode ? "page" : undefined}
              className={
                "inline-flex min-h-11 items-center justify-center rounded-full border border-ink-black px-1 text-small " +
                (view.periode === periode ? "bg-ink-black text-cream-paper" : "bg-pure-white text-ink-black")
              }
            >
              {PERIOD_LABEL[periode]}
            </Link>
          ))}
        </nav>
      </div>

      <PeriodDetail groupId={groupId} view={view} sources={sources} currentMonth={currentMonth} />

      {view.periode === "musim" && board && season?.closedAt && (
        <p className="rounded-2xl border-2 border-ink-black bg-fresh-grass px-4 py-3 text-ui" data-testid="season-champion">
          {season.name} sudah selesai.{" "}
          {champions(board).length > 0 ? `Juara: ${champions(board).map((r) => names[r.memberId] ?? "?").join(" & ")}.` : "Tanpa juara."}
        </p>
      )}

      {!board ? (
        <Card className="flex flex-col gap-2">
          <p className="text-ui">
            {view.periode === "sesi"
              ? "Belum ada sesi yang berlangsung atau punya match."
              : "Grup ini belum punya musim. Lihat klasemen Bulan ini atau All-time."}
          </p>
          {view.periode === "musim" && (
            <Link href={`/g/${groupId}/musim`} className={textLinkClass}>
              {isAdmin ? "Mulai musim" : "Tentang musim"}
            </Link>
          )}
        </Card>
      ) : board.matchCount === 0 ? (
        <Card>
          <p className="text-ui">Belum ada match ganda yang selesai di periode ini.</p>
        </Card>
      ) : view.tab === "klasemen" ? (
        <Standings board={board} names={names} me={member.id} minMatches={view.periode === "sesi" ? 0 : group.scoring.minMatches} groupId={groupId} />
      ) : view.tab === "pasangan" ? (
        <Pairs board={board} names={names} me={member.id} />
      ) : (
        <FormTable
          rows={[...board.ranked, ...board.unranked]}
          matches={sources.matches.filter((m) => period !== null && inPeriod(m, period))}
          names={names}
          me={member.id}
          groupId={groupId}
        />
      )}

      <Card className="flex flex-col gap-2 @panel:max-w-2xl">
        <h2 className="text-lead">Cara hitung</h2>
        <p className="text-small">Leaderboard ganda. {describeScoring(group.scoring)}</p>
        <p className="text-small">Bila poin sama: win rate, lalu selisih poin, lalu jumlah main.</p>
        {isAdmin && (
          <Link href={`/g/${groupId}/pengaturan`} className={textLinkClass}>
            Ubah sistem poin
          </Link>
        )}
      </Card>
    </Page>
  );
}

function describeScoring(s: ScoringConfig): string {
  const parts = [`Menang ${s.winPoints} poin, kalah ${s.lossPoints} poin.`];
  if (s.lossBonus) parts.push(`Kalah tipis (selisih total ≤ ${s.lossBonus.maxMargin}) +${s.lossBonus.points} poin.`);
  if (s.minMatches > 0) parts.push(`Minimal ${s.minMatches} kali main untuk masuk peringkat (kecuali klasemen sesi).`);
  return parts.join(" ");
}

function PeriodDetail({
  groupId,
  view,
  sources,
  currentMonth,
}: {
  groupId: string;
  view: View;
  sources: LeaderboardSources;
  currentMonth: MonthRef;
}) {
  if (view.periode === "sesi" && view.sesi) {
    return (
      <LinkSelect
        className="sm:max-w-md"
        label="Sesi"
        value={hrefFor(groupId, view)}
        options={sources.sessions.map((s) => ({
          href: hrefFor(groupId, { ...view, sesi: s.id }),
          label: `${formatShortDateId(s.startsAt)}${s.venue ? ` · ${s.venue}` : ""}${s.status === "running" ? " · berlangsung" : ""}`,
        }))}
      />
    );
  }
  if (view.periode === "bulan") {
    const months = monthsWithMatches(sources.matches, currentMonth);
    if (!months.some((m) => monthKey(m) === monthKey(view.bulan))) months.push(view.bulan);
    return (
      <LinkSelect
        className="sm:max-w-md"
        label="Bulan"
        value={hrefFor(groupId, view)}
        options={months.map((bulan) => ({ href: hrefFor(groupId, { ...view, bulan }), label: formatMonthId(bulan) }))}
      />
    );
  }
  if (view.periode === "musim" && view.musim) {
    return (
      <LinkSelect
        className="sm:max-w-md"
        label="Musim"
        value={hrefFor(groupId, view)}
        options={sources.seasons.map((s) => ({
          href: hrefFor(groupId, { ...view, musim: s.id }),
          label: `${s.name}${s.closedAt ? " · selesai" : ""}`,
        }))}
      />
    );
  }
  return null;
}

function Avatar({ name, size }: { name: string; size: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={
        "flex shrink-0 items-center justify-center rounded-full border-2 border-cream-paper bg-pure-ink text-cream-paper " +
        (size === "lg" ? "size-14 text-ui" : "size-12 text-small")
      }
    >
      {initials(name)}
    </span>
  );
}

const PODIUM_HEIGHT: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-14" };

function Standings({ board, names, me, minMatches, groupId }: { board: Leaderboard; names: Names; me: string; minMatches: number; groupId: string }) {
  // Tampilan podium: 2 – 1 – 3. Urutan DOM tetap peringkat agar pembaca layar membaca 1, 2, 3.
  const visualOrder = ["order-2", "order-1", "order-3"];
  return (
    // Desktop: podium menempel di kiri, tabel di kanan.
    <div className={`flex flex-col gap-6 ${board.podium.length > 0 ? "@panel:grid @panel:grid-cols-[22rem_minmax(0,1fr)] @panel:items-start @panel:gap-8" : ""}`}>
      {board.podium.length > 0 && (
        <section aria-labelledby="podium" className="rounded-2xl border border-ink-black bg-ink-black px-4 pt-5 text-cream-paper @panel:sticky @panel:top-6">
          <h2 id="podium" className="sr-only">
            Tiga teratas
          </h2>
          <ol className="mx-auto flex max-w-md items-end justify-center gap-3">
            {board.podium.map((row, i) => {
              const rank = row.rank ?? i + 1;
              const first = rank === 1;
              return (
                <li key={row.memberId} className={`flex w-1/3 min-w-0 flex-col items-center gap-1 ${visualOrder[i]}`} data-testid="podium-item">
                  <Avatar name={names[row.memberId] ?? "?"} size={first ? "lg" : "sm"} />
                  <span className="w-full truncate text-center text-small">
                    {names[row.memberId] ?? "?"}
                    {row.memberId === me && " (kamu)"}
                  </span>
                  <span className="text-caption">{row.tablePoints} poin</span>
                  <span
                    className={
                      "mt-1 flex w-full justify-center rounded-t-2xl pt-2 text-sub " +
                      PODIUM_HEIGHT[Math.min(rank, 3)] +
                      (first ? " bg-fresh-grass text-ink-black" : " bg-pure-ink text-cream-paper")
                    }
                  >
                    <span className="sr-only">Peringkat </span>
                    {rank}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="flex min-w-0 flex-col gap-6">
        {board.ranked.length > 0 && (
          <section aria-labelledby="klasemen" className="flex flex-col gap-3">
            <h2 id="klasemen" className="text-sub">
              Klasemen
            </h2>
            <StandingTable rows={board.ranked} names={names} me={me} caption="Klasemen ganda" testId="standings" groupId={groupId} />
          </section>
        )}

        {board.unranked.length > 0 && (
          <section aria-labelledby="belum-peringkat" className="flex flex-col gap-3">
            <h2 id="belum-peringkat" className="text-sub">
              Belum masuk peringkat
            </h2>
            <p className="text-small">Main kurang dari {minMatches} kali di periode ini.</p>
            <StandingTable rows={board.unranked} names={names} me={me} caption="Pemain belum masuk peringkat" testId="unranked" groupId={groupId} />
          </section>
        )}
      </div>
    </div>
  );
}

/** Judul kolom. `full` = label lengkap yang menggantikan singkatan mulai layar tablet. */
function Th({ children, title, full, left, className = "" }: { children: ReactNode; title?: string; full?: string; left?: boolean; className?: string }) {
  return (
    <th scope="col" className={`px-1 py-2 text-caption font-medium ${left ? "text-left" : "text-right"} ${className}`}>
      {title ? (
        <>
          <abbr title={title} className={`no-underline ${full ? "sm:hidden" : ""}`}>
            {children}
          </abbr>
          {full && <span className="hidden sm:inline">{full}</span>}
        </>
      ) : (
        children
      )}
    </th>
  );
}

function StandingTable({
  rows,
  names,
  me,
  caption,
  testId,
  groupId,
}: {
  rows: StandingRow[];
  names: Names;
  me: string;
  caption: string;
  testId: string;
  groupId: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-black bg-pure-white">
      <table className="w-full table-fixed border-collapse text-small tabular-nums" data-testid={testId}>
        <caption className="sr-only">{caption}</caption>
        {/* Kolom angka sempit di ponsel; melebar dengan label lengkap mulai tablet. */}
        <colgroup>
          <col className="w-8 sm:w-12" />
          <col />
          <col className="w-8 sm:w-14" />
          <col className="w-7 sm:w-16" />
          <col className="w-7 sm:w-14" />
          <col className="w-10 sm:w-18" />
          <col className="w-9 sm:w-16" />
          <col className="w-10 sm:w-16" />
        </colgroup>
        <thead className="border-b border-ink-black">
          <tr>
            <Th title="Peringkat" left className="pl-3">
              #
            </Th>
            <Th left>Pemain</Th>
            <Th>Main</Th>
            <Th title="Menang" full="Menang">
              M
            </Th>
            <Th title="Kalah" full="Kalah">
              K
            </Th>
            <Th title="Win rate" full="Win rate">
              Win
            </Th>
            <Th title="Selisih poin" full="Selisih">
              +/−
            </Th>
            <Th className="pr-3">Poin</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mine = row.memberId === me;
            return (
              <tr
                key={row.memberId}
                className={mine ? "bg-fresh-grass outline-2 -outline-offset-2 outline-ink-black" : "border-t border-hairline-mist first:border-t-0"}
                aria-current={mine ? "true" : undefined}
                data-testid="standing-row"
                data-member={row.memberId}
              >
                <td className="py-3 pl-3 text-left">{row.rank ?? "–"}</td>
                <th scope="row" className="px-1 text-left font-medium">
                  <Link href={`/g/${groupId}/anggota/${row.memberId}`} className="flex min-h-11 flex-col justify-center underline-offset-2 hover:underline">
                    <span className="block truncate">{names[row.memberId] ?? "?"}</span>
                    {mine && <span className="block text-caption">kamu</span>}
                  </Link>
                </th>
                <td className="px-1 text-right">{row.played}</td>
                <td className="px-1 text-right">{row.won}</td>
                <td className="px-1 text-right">{row.lost}</td>
                <td className="px-1 text-right">{formatPercent(row.winRate)}</td>
                <td className="px-1 text-right">{formatSigned(row.pointDiff)}</td>
                <td className="pr-3 pl-1 text-right text-ui" data-testid="table-points">
                  {row.tablePoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pairs({ board, names, me }: { board: Leaderboard; names: Names; me: string }) {
  const name = (id: string) => names[id] ?? "?";
  const best = board.myBestPartner;
  return (
    // Desktop: kartu partner terbaikmu di kiri, daftar pasangan di kanan.
    <div className="flex flex-col gap-6 @panel:grid @panel:grid-cols-[22rem_minmax(0,1fr)] @panel:items-start @panel:gap-8">
      <Card className="flex flex-col gap-2" data-testid="my-best-partner">
        <h2 className="text-lead">Partner terbaikmu</h2>
        {best ? (
          <p className="text-ui">
            {name(best.partnerId)} · {best.won} menang dari {best.played} main ({formatPercent(best.winRate)}), selisih{" "}
            {formatSigned(best.pointDiff)}
          </p>
        ) : (
          <p className="text-ui">Belum ada partner yang main bareng kamu minimal {board.pairMin} kali di periode ini.</p>
        )}
      </Card>

      <section aria-labelledby="pasangan-terbaik" className="flex min-w-0 flex-col gap-3">
        <h2 id="pasangan-terbaik" className="text-sub">
          Pasangan terbaik
        </h2>
        <p className="text-small">Pasangan yang main bareng minimal {board.pairMin} kali, urut win rate lalu selisih poin.</p>
        {board.pairs.length === 0 ? (
          <Card>
            <p className="text-ui">Belum ada pasangan yang memenuhi syarat.</p>
          </Card>
        ) : (
          <ol className="grid gap-2 md:grid-cols-2" data-testid="pairs">
            {board.pairs.map((pair, i) => {
              const mine = pair.members.includes(me);
              return (
                <li
                  key={pair.members.join("-")}
                  className={
                    "flex items-center gap-3 rounded-2xl px-4 py-3 " +
                    (mine ? "border-2 border-ink-black bg-fresh-grass" : "border border-ink-black bg-pure-white")
                  }
                  data-testid="pair-row"
                >
                  <span className="w-6 text-lead tabular-nums">{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-ui">
                      {name(pair.members[0])} &amp; {name(pair.members[1])}
                    </span>
                    <span className="text-small tabular-nums">
                      {pair.played} main · {pair.won}–{pair.lost} · selisih {formatSigned(pair.pointDiff)}
                    </span>
                  </span>
                  <span className="text-lead tabular-nums">{formatPercent(pair.winRate)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Form 5 match terakhir & streak berjalan per pemain di periode ini (PRD L6), urut klasemen. */
function FormTable({ rows, matches, names, me, groupId }: { rows: StandingRow[]; matches: MatchRecord[]; names: Names; me: string; groupId: string }) {
  return (
    <section aria-labelledby="form" className="flex flex-col gap-3">
      <h2 id="form" className="text-sub">
        Form 5 match terakhir
      </h2>
      <p className="text-small">M = menang, K = kalah; terbaru di kiri.</p>
      <ul className="grid gap-2 md:grid-cols-2 @5xl:grid-cols-3" data-testid="form-table">
        {rows.map((row) => {
          const form = recentForm(matches, row.memberId);
          const streak = currentStreak(matches, row.memberId);
          const mine = row.memberId === me;
          return (
            <li
              key={row.memberId}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${mine ? "border-2 border-ink-black bg-fresh-grass" : "border border-ink-black bg-pure-white"}`}
              data-testid="form-row"
              data-member={row.memberId}
            >
              <Link href={`/g/${groupId}/anggota/${row.memberId}`} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                <span className="truncate text-ui">
                  {names[row.memberId] ?? "?"}
                  {mine && " (kamu)"}
                </span>
                {streak && streak.length >= 2 && (
                  <span className="text-caption" data-testid="streak">
                    {streak.result === "W" ? "Menang" : "Kalah"} {streak.length}× beruntun
                  </span>
                )}
              </Link>
              <span className="sr-only">Form: {form.map((f) => (f === "W" ? "menang" : "kalah")).join(", ")}</span>
              <ol className="flex gap-1" aria-hidden="true" data-testid="form-chips">
                {form.map((f, i) => (
                  <li key={i} className={`flex size-7 items-center justify-center rounded-full border border-ink-black text-caption ${f === "W" ? "bg-fresh-grass" : "bg-pure-white"}`}>
                    {f === "W" ? "M" : "K"}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
