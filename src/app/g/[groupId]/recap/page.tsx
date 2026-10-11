import type { Metadata } from "next";
import Link from "next/link";
import { LinkSelect } from "@/components/link-select";
import { NoAccess } from "@/components/no-access";
import { Badge, Card, Page, TopBar, textLinkClass } from "@/components/ui";
import { monthKey, monthsWithMatches, parseMonthKey, type MonthRef } from "@/lib/core/leaderboard";
import { buildPeriodRecap, previousMonth, previousSeasonId, type RankChange } from "@/lib/core/period-recap";
import { inPeriod, jakartaMonth, type Period } from "@/lib/core/standings";
import { getGroup } from "@/lib/db/groups";
import { loadLeaderboardSources } from "@/lib/db/leaderboard";
import { formatMonthId } from "@/lib/format";
import { periodHighlights } from "@/lib/recap-view";
import { pageAccess } from "../access";

export const metadata: Metadata = { title: "Recap bulan & musim" };

type Kind = "bulan" | "musim";

function RankChangeBadge({ change }: { change: RankChange["change"] }) {
  if (change === null) return <Badge tone="outline">Baru</Badge>;
  if (change === 0) return <Badge tone="muted">Tetap</Badge>;
  return (
    <Badge tone={change > 0 ? "accent" : "neutral"}>
      <span aria-hidden="true">{change > 0 ? "▲" : "▼"}</span>
      <span className="sr-only">{change > 0 ? "naik" : "turun"}</span> {Math.abs(change)}
    </Badge>
  );
}

/** Recap bulanan / musim (PRD R6): juara, sorotan, perubahan peringkat. Diturunkan dari match ganda. */
export default async function PeriodRecapPage({ params, searchParams }: PageProps<"/g/[groupId]/recap">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/recap`} />;
  const me = access.membership.member.id;
  const sp = await searchParams;
  const param = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  const [group, sources] = await Promise.all([getGroup(groupId), loadLeaderboardSources(groupId)]);
  const names = sources.names;
  const doubles = sources.matches.filter((m) => m.kind === "doubles");

  const currentMonth = jakartaMonth(new Date());
  const kind: Kind = param("periode") === "musim" ? "musim" : "bulan";
  // Bulan yang punya match ganda + bulan ini (terbaru dulu); bawaan = bulan terbaru yang punya match.
  const months = monthsWithMatches(doubles, currentMonth);
  const monthHasData = (m: MonthRef) => doubles.some((x) => inPeriod(x, { kind: "month", ...m }));
  const month = parseMonthKey(param("bulan")) ?? months.find(monthHasData) ?? currentMonth;
  const season = sources.seasons.find((s) => s.id === param("musim")) ?? sources.seasons.find((s) => s.closedAt === null) ?? sources.seasons[0] ?? null;

  let period: Period | null = null;
  let previous: Period | null = null;
  let title = "";
  let compareLabel = "";
  let ongoing = false;
  let leaderboardHref = `/g/${groupId}/leaderboard`;
  if (kind === "bulan") {
    const prev = previousMonth(month);
    period = { kind: "month", ...month };
    previous = { kind: "month", ...prev };
    title = formatMonthId(month);
    compareLabel = formatMonthId(prev);
    ongoing = monthKey(month) === monthKey(currentMonth);
    leaderboardHref = `/g/${groupId}/leaderboard?bulan=${monthKey(month)}`;
  } else if (season) {
    const prevId = previousSeasonId(sources.seasons, season.id);
    period = { kind: "season", seasonId: season.id };
    previous = prevId ? { kind: "season", seasonId: prevId } : null;
    title = season.name;
    compareLabel = sources.seasons.find((s) => s.id === prevId)?.name ?? "";
    ongoing = season.closedAt === null;
    leaderboardHref = `/g/${groupId}/leaderboard?periode=musim&musim=${season.id}`;
  }
  const recap = period ? buildPeriodRecap(sources.matches, group.scoring, period, previous) : null;
  const highlights = recap ? periodHighlights(recap, names, ongoing) : [];
  const name = (id: string) => names[id] ?? "?";
  const base = `/g/${groupId}/recap`;

  return (
    <Page width="regular">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <h1 className="text-title">Recap bulan &amp; musim</h1>

      <nav aria-label="Jenis recap" className="grid grid-cols-2 gap-2">
        {(["bulan", "musim"] as const).map((k) => (
          <Link
            key={k}
            href={k === "bulan" ? base : `${base}?periode=musim`}
            aria-current={kind === k ? "page" : undefined}
            className={
              "inline-flex min-h-11 items-center justify-center rounded-full border border-ink-black text-small " +
              (kind === k ? "bg-ink-black text-cream-paper" : "bg-pure-white text-ink-black")
            }
          >
            {k === "bulan" ? "Bulanan" : "Musim"}
          </Link>
        ))}
      </nav>

      {kind === "bulan" ? (
        <LinkSelect
          label="Bulan"
          value={`${base}?bulan=${monthKey(month)}`}
          options={(months.some((m) => monthKey(m) === monthKey(month)) ? months : [month, ...months]).map((m) => ({
            href: `${base}?bulan=${monthKey(m)}`,
            label: formatMonthId(m),
          }))}
        />
      ) : (
        season && (
          <LinkSelect
            label="Musim"
            value={`${base}?periode=musim&musim=${season.id}`}
            options={sources.seasons.map((s) => ({ href: `${base}?periode=musim&musim=${s.id}`, label: s.closedAt ? s.name : `${s.name} (berjalan)` }))}
          />
        )
      )}

      {!recap ? (
        <Card className="flex flex-col gap-2">
          <p className="text-ui">Grup ini belum punya musim.</p>
          <Link href={`/g/${groupId}/musim`} className={textLinkClass}>
            Tentang musim
          </Link>
        </Card>
      ) : recap.totals.matches === 0 ? (
        <Card>
          <p className="text-ui">Belum ada match ganda yang selesai di {title}.</p>
        </Card>
      ) : (
        <>
          <section aria-labelledby="ringkasan" className="flex flex-col gap-1">
            <h2 id="ringkasan" className="text-sub">
              {title}
            </h2>
            <p className="text-ui" data-testid="period-totals">
              {recap.totals.sessions} sesi · {recap.totals.matches} match · {recap.totals.games} game · {recap.totals.players} pemain
            </p>
            {ongoing && <p className="text-small">{kind === "bulan" ? "Bulan" : "Musim"} masih berjalan; angka bisa berubah.</p>}
          </section>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="highlights">
            {highlights.map((h) => (
              <li
                key={h.key}
                className={
                  "flex min-w-0 flex-col gap-1 rounded-2xl border border-ink-black p-4 " +
                  (h.key === "champion" ? "col-span-2 bg-fresh-grass sm:col-span-3" : "bg-pure-white")
                }
                data-testid={`highlight-${h.key}`}
              >
                <span className="text-small">{h.title}</span>
                <span className={`${h.key === "champion" ? "text-title" : "text-lead"} break-words`}>{h.value}</span>
                <span className="text-small break-words">{h.detail}</span>
              </li>
            ))}
          </ul>

          {recap.rankChanges.length > 0 && (
            <section aria-labelledby="peringkat" className="flex flex-col gap-3">
              <h2 id="peringkat" className="text-sub">
                Peringkat
              </h2>
              <p className="text-small">
                {previous && compareLabel ? `Perubahan dibanding ${compareLabel}. "Baru" = belum masuk peringkat di sana.` : "Belum ada periode sebelumnya untuk dibandingkan."}
              </p>
              <ol className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white" data-testid="rank-changes">
                {recap.rankChanges.map((r) => (
                  <li
                    key={r.memberId}
                    className={`flex min-h-11 items-center gap-3 px-4 py-2 first:rounded-t-2xl last:rounded-b-2xl ${r.memberId === me ? "bg-fresh-grass" : ""}`}
                    data-testid="rank-change"
                  >
                    <span className="w-6 text-lead tabular-nums">{r.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-ui">
                      {name(r.memberId)}
                      {r.memberId === me && " (kamu)"}
                    </span>
                    {previous && <RankChangeBadge change={r.change} />}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Link href={leaderboardHref} className={textLinkClass}>
            Klasemen lengkap {title}
          </Link>
        </>
      )}
    </Page>
  );
}
