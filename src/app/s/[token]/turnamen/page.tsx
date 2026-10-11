import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketBoard, FORMAT_LABEL, PoolGroups, PoolTable, TournamentSchedule, TournamentStandings, entryLabel } from "@/components/bracket-view";
import { Page, textLinkClass } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { loadPlay } from "@/lib/db/play";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { getTournament, tournamentView } from "@/lib/db/tournaments";
import { formatDateId } from "@/lib/format";

export const metadata: Metadata = { title: "Turnamen", robots: { index: false, follow: false } };

/** Turnamen publik (tanpa login, lewat token sesi): grup, bagan, jadwal, klasemen; auto-refresh selama sesi berlangsung. */
export default async function PublicTournamentPage({ params }: PageProps<"/s/[token]/turnamen">) {
  const { token } = await params;
  const session = await findSessionByShareToken(token);
  const tournament = session ? await getTournament(session.id) : null;
  if (!session || !tournament) notFound();
  const group = await getGroup(session.groupId);
  const ctx = await loadPlay(group, session);
  const names = Object.fromEntries(ctx.members.map((m) => [m.id, m.display_name]));
  const view = tournamentView(tournament, ctx.matches);

  return (
    <Page width="wide">
      <div className="flex flex-col gap-2">
        <p className="text-small">
          {group.name} · {formatDateId(session.startsAt)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
        <h1 className="text-title break-words">{view.name}</h1>
        <p className="text-small">
          {view.format === "groups_knockout" ? `${view.groups!.count} grup + gugur` : FORMAT_LABEL[view.format]} · {view.entries.length}{" "}
          {view.kind === "doubles" ? "pasangan" : "pemain"}
          {view.champion !== null ? ` · Juara: ${entryLabel(view, view.champion, names)}` : ""}
        </p>
        {session.status === "running" && <AutoRefresh />}
      </div>
      {view.format === "round_robin" && <PoolTable view={view} pool={view.pools[0]} names={names} title="Klasemen" />}
      {view.format === "groups_knockout" && (
        <section aria-labelledby="fase-grup" className="flex flex-col gap-3">
          <h2 id="fase-grup" className="text-sub">
            Fase grup
          </h2>
          <PoolGroups view={view} names={names} />
        </section>
      )}
      <BracketBoard view={view} names={names} />
      <section aria-labelledby="jadwal" className="flex flex-col gap-3">
        <h2 id="jadwal" className="text-sub">
          Jadwal
        </h2>
        <TournamentSchedule view={view} names={names} />
      </section>
      {view.format !== "round_robin" && (
        <section aria-labelledby="klasemen" className="flex flex-col gap-3">
          <h2 id="klasemen" className="text-sub">
            Klasemen
          </h2>
          <TournamentStandings view={view} names={names} />
        </section>
      )}
      {session.status === "running" && (
        <Link href={`/s/${token}/skor`} className={textLinkClass}>
          Lihat skor langsung
        </Link>
      )}
    </Page>
  );
}
