import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Badge, Card, Page, TopBar, textLinkClass } from "@/components/ui";
import { buildLeaderboard, champions } from "@/lib/core/leaderboard";
import { jakartaMonth } from "@/lib/core/standings";
import { getGroup } from "@/lib/db/groups";
import { loadGroupMatches } from "@/lib/db/matches";
import { memberNames } from "@/lib/db/members";
import { listSeasons, type Season } from "@/lib/db/seasons";
import { formatMonthId, formatShortDateId } from "@/lib/format";
import { fromJakartaParts, toJakartaParts } from "@/lib/time";
import { pageAccess } from "../access";
import { CloseSeasonButton, NewSeasonForm } from "./season-admin";

export const metadata: Metadata = { title: "Musim" };

const day = (date: string) => formatShortDateId(fromJakartaParts(date, "12:00")!);

/** Musim (PRD L9): buat, tutup/arsipkan, juara musim. Klasemen musim diturunkan dari match. */
export default async function SeasonsPage({ params }: PageProps<"/g/[groupId]/musim">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/musim`} />;
  const { member, via } = access.membership;
  const isAdmin = member.role === "admin" && via === "account";
  const [group, seasons, matches, names] = await Promise.all([getGroup(groupId), listSeasons(groupId), loadGroupMatches(groupId), memberNames(groupId)]);

  const now = new Date();
  const open = seasons.find((s) => s.closedAt === null) ?? null;
  const archive = seasons.filter((s) => s.closedAt !== null);
  const board = (s: Season) => buildLeaderboard(matches, group.scoring, { kind: "season", seasonId: s.id });
  const who = (ids: string[]) => ids.map((id) => names[id] ?? "?").join(" & ");
  const leaderboardHref = (s: Season) => `/g/${groupId}/leaderboard?periode=musim&musim=${s.id}`;

  return (
    <Page>
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Musim</h1>
        <p className="text-ui">Sesi masuk musim menurut tanggalnya. Klasemen musim dihitung dari match di sesi-sesi itu, memakai sistem poin grup.</p>
      </div>

      {open ? (
        <Card className="flex flex-col gap-3" data-testid="open-season">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sub">{open.name}</h2>
            <Badge tone="accent">Berjalan</Badge>
          </div>
          <p className="text-small">
            Mulai {day(open.startsOn)}
            {open.endsOn ? ` · selesai ${day(open.endsOn)}` : ""}
          </p>
          {(() => {
            const b = board(open);
            const top = champions(b);
            return (
              <p className="text-ui" data-testid="season-leader">
                {b.matchCount === 0 ? "Belum ada match di musim ini." : top.length > 0 ? `Memimpin: ${who(top.map((r) => r.memberId))} · ${top[0].tablePoints} poin` : `${b.matchCount} match, belum ada yang memenuhi minimal main.`}
              </p>
            );
          })()}
          <Link href={leaderboardHref(open)} className={textLinkClass}>
            Lihat klasemen musim
          </Link>
          {isAdmin && <CloseSeasonButton groupId={groupId} seasonId={open.id} name={open.name} />}
        </Card>
      ) : isAdmin ? (
        <NewSeasonForm groupId={groupId} defaultName={`Musim ${formatMonthId(jakartaMonth(now))}`} today={toJakartaParts(now).date} />
      ) : (
        <Card>
          <p className="text-ui">Belum ada musim yang berjalan.</p>
        </Card>
      )}

      <section aria-labelledby="arsip" className="flex flex-col gap-3">
        <h2 id="arsip" className="text-sub">
          Arsip musim
        </h2>
        {archive.length === 0 ? (
          <p className="text-small">Musim yang sudah ditutup akan muncul di sini beserta juaranya.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="season-archive">
            {archive.map((s) => {
              const b = board(s);
              const top = champions(b);
              return (
                <li key={s.id} className="flex flex-col gap-1 rounded-2xl border border-ink-black bg-pure-white px-4 py-3">
                  <span className="text-lead">{s.name}</span>
                  <span className="text-small">
                    {day(s.startsOn)} – {s.endsOn ? day(s.endsOn) : "?"} · {b.matchCount} match
                  </span>
                  <span className="text-ui" data-testid="season-champion">
                    {top.length > 0 ? `Juara: ${who(top.map((r) => r.memberId))} (${top[0].tablePoints} poin)` : "Tanpa juara"}
                  </span>
                  <Link href={leaderboardHref(s)} className={textLinkClass}>
                    Klasemen akhir
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Page>
  );
}
