import type { Metadata } from "next";
import Link from "next/link";
import { BracketBoard, FORMAT_LABEL, PoolGroups, PoolTable, TournamentSchedule, TournamentStandings, entryLabel, itemTitle } from "@/components/bracket-view";
import { CopyLink } from "@/components/copy-link";
import { NoAccess } from "@/components/no-access";
import { Badge, Card, Notice, Page, TopBar, buttonClass } from "@/components/ui";
import { groupLetter, type TournamentFormat } from "@/lib/core/tournament";
import { getGroup } from "@/lib/db/groups";
import { loadPlay } from "@/lib/db/play";
import { getSession } from "@/lib/db/sessions";
import { getTournament, tournamentView, type TournamentView } from "@/lib/db/tournaments";
import { publicEnv } from "@/lib/env";
import { formatShortDateId } from "@/lib/format";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../../access";
import { DeleteTournament, StartSlot } from "./tournament-admin";
import { TournamentForm } from "./tournament-form";

export const metadata: Metadata = { title: "Turnamen" };

type Tab = "grup" | "bagan" | "jadwal" | "klasemen";
const TAB_LABEL: Record<Tab, string> = { grup: "Grup", bagan: "Bagan", jadwal: "Jadwal", klasemen: "Klasemen" };
/** Tab per format; tab pertama = bawaan. */
const TABS: Record<TournamentFormat, Tab[]> = {
  knockout: ["bagan", "jadwal", "klasemen"],
  round_robin: ["klasemen", "jadwal"],
  groups_knockout: ["grup", "bagan", "jadwal", "klasemen"],
};
const GRID_COLS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as Record<number, string>;

/** Teks WhatsApp: juara (bila sudah), match berikutnya, tautan turnamen publik. */
function shareText(view: TournamentView, names: Record<string, string>, url: string): string {
  const lines = [view.name];
  if (view.champion !== null) lines.push(`Juara: ${entryLabel(view, view.champion, names)}`);
  else {
    const next = view.schedule.find((i) => i.state === "ready");
    if (next) {
      const where = next.group !== null ? ` (Grup ${groupLetter(next.group)})` : "";
      lines.push(`Berikutnya ${itemTitle(view, next)}${where}: ${entryLabel(view, next.a, names)} vs ${entryLabel(view, next.b, names)}`);
    }
  }
  lines.push(`${view.bracket ? "Bagan" : "Klasemen"} & jadwal: ${url}`);
  return lines.join("\n");
}

/** Turnamen di sesi (sistem gugur, round robin, grup + gugur): grup, bagan, jadwal (admin memulai match), klasemen. */
export default async function TournamentPage({ params, searchParams }: PageProps<"/g/[groupId]/sesi/[sessionId]/turnamen">) {
  const { groupId, sessionId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/sesi/${sessionId}/turnamen`} />;
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
  const [ctx, tournament] = await Promise.all([loadPlay(group, session), getTournament(session.id)]);
  const names = Object.fromEntries(ctx.members.map((m) => [m.id, m.display_name]));
  const api = `/api/groups/${groupId}/sessions/${sessionId}/tournament`;
  const board = `/g/${groupId}/sesi/${sessionId}/main`;
  const self = `/g/${groupId}/sesi/${sessionId}/turnamen`;
  const title = `${formatShortDateId(session.startsAt)}${session.venue ? ` · ${session.venue}` : ""}`;

  if (!tournament) {
    return (
      <Page width="narrow">
        <TopBar back={back} title={title} />
        <h1 className="text-title">Turnamen</h1>
        {isAdmin && session.status !== "finished" ? (
          ctx.present.length < 2 ? (
            <Notice>Tandai minimal 2 peserta hadir di halaman sesi dulu.</Notice>
          ) : (
            <TournamentForm
              url={api}
              players={ctx.present.map((id) => ({ id, name: names[id] ?? "?" }))}
              defaultName={`Turnamen ${formatShortDateId(session.startsAt)}`}
            />
          )
        ) : (
          <Card>
            <p className="text-ui">Belum ada turnamen di sesi ini.</p>
          </Card>
        )}
      </Page>
    );
  }

  const view = tournamentView(tournament, ctx.matches);
  const tabs = TABS[view.format];
  const tabParam = (await searchParams).tab;
  const tab: Tab = tabs.find((t) => t === tabParam) ?? tabs[0];
  const publicUrl = `${publicEnv().siteUrl}/s/${session.shareToken}/turnamen`;
  const canStart = isAdmin && session.status === "running";
  const played = ctx.matches.some((m) => m.tournament?.id === tournament.id && m.status !== "void");
  const champion = view.champion;
  const busy = (seed: number) => view.entries[seed - 1].players.some((id) => ctx.onCourt.has(id));
  const format = view.format === "groups_knockout" ? `${view.groups!.count} grup + gugur` : FORMAT_LABEL[view.format].toLowerCase();

  return (
    <Page width="wide">
      <TopBar back={back} title={title} />
      <div className="flex flex-col gap-2">
        <p className="text-small">
          Turnamen · {format} · {view.entries.length} {view.kind === "doubles" ? "pasangan · ganda" : "pemain · tunggal"} · unggulan{" "}
          {view.seeding === "rating" ? "dari rating" : "acak"}
        </p>
        <h1 className="text-title break-words">{view.name}</h1>
      </div>

      {champion !== null && (
        <div className="flex items-center gap-3 rounded-2xl border border-ink-black bg-fresh-grass p-5" data-testid="tournament-champion">
          <Badge tone="neutral">Juara</Badge>
          <p className="text-lead">{entryLabel(view, champion, names)}</p>
        </div>
      )}
      {session.status === "planned" && isAdmin && <Notice>Mulai sesi di halaman sesi untuk memulai match turnamen.</Notice>}

      <nav aria-label="Tampilan turnamen" className={`grid ${GRID_COLS[tabs.length]} gap-1 rounded-2xl border border-ink-black bg-ink-black p-1 sm:max-w-xl`}>
        {tabs.map((key) => (
          <Link
            key={key}
            href={key === tabs[0] ? self : `${self}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={"flex min-h-11 items-center justify-center rounded-lg text-ui " + (tab === key ? "bg-fresh-grass text-ink-black" : "text-cream-paper")}
          >
            {TAB_LABEL[key]}
          </Link>
        ))}
      </nav>

      {tab === "grup" && <PoolGroups view={view} names={names} />}
      {tab === "bagan" && <BracketBoard view={view} names={names} />}
      {tab === "jadwal" && (
        <TournamentSchedule
          view={view}
          names={names}
          scoreboardHref={board}
          action={(item) =>
            canStart && item.state === "ready" && item.a !== null && item.b !== null ? (
              busy(item.a) || busy(item.b) ? (
                <p className="text-small">Ada pemain yang masih main di lapangan lain.</p>
              ) : (
                <StartSlot
                  url={`${api}/matches`}
                  id={item.key}
                  target={item.link.stage === "knockout" ? { round: item.link.round, slot: item.link.slot } : { a: item.link.a, b: item.link.b }}
                  emptyCourts={ctx.emptyCourts}
                  boardHref={board}
                />
              )
            ) : null
          }
        />
      )}
      {tab === "klasemen" &&
        (view.format === "round_robin" ? <PoolTable view={view} pool={view.pools[0]} names={names} title="Klasemen" /> : <TournamentStandings view={view} names={names} />)}

      {tab !== "jadwal" && canStart && view.schedule.some((i) => i.state === "ready") && (
        <Link href={`${self}?tab=jadwal`} className={buttonClass("accent", "lg", "sm:w-auto sm:self-start sm:px-8")}>
          Mulai match berikutnya
        </Link>
      )}

      <section aria-labelledby="bagikan" className="flex flex-col gap-3">
        <h2 id="bagikan" className="text-sub">
          Bagikan turnamen
        </h2>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText(view, names, publicUrl))}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("secondary", "md", "self-start")}
        >
          Bagikan ke WhatsApp
        </a>
        <CopyLink url={publicUrl} label="Salin tautan turnamen" done="Tautan turnamen disalin. Bisa dibuka tanpa login." />
      </section>

      {isAdmin && !played && <DeleteTournament url={api} />}
    </Page>
  );
}
