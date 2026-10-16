import type { Metadata } from "next";
import Link from "next/link";
import { CopyLink } from "@/components/copy-link";
import { CostEstimate } from "@/components/cost-estimate";
import { NoAccess } from "@/components/no-access";
import { Badge, ButtonLink, Card, Page, Split, TopBar, buttonClass } from "@/components/ui";
import { canPlay, playersOf } from "@/lib/core/roles";
import { getGroup } from "@/lib/db/groups";
import { listMembers } from "@/lib/db/members";
import { getSession } from "@/lib/db/sessions";
import { getTournament } from "@/lib/db/tournaments";
import { publicEnv } from "@/lib/env";
import { describeRules, formatDateId, formatTimeRangeId } from "@/lib/format";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../access";
import { PLAY_MODE_LABEL, STATUS_LABEL, STATUS_TONE } from "../status";
import { ApplyRsvp, RsvpPicker } from "./rsvp";
import { AttendanceEditor, DeleteSession, StatusActions } from "./session-admin";

export const metadata: Metadata = { title: "Sesi" };

const GAMES_LABEL = { 1: "1 game", 3: "Best of 3", 5: "Best of 5" } as const;

export default async function SessionPage({ params }: PageProps<"/g/[groupId]/sesi/[sessionId]">) {
  const { groupId, sessionId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/sesi/${sessionId}`} />;
  const { member, via } = access.membership;
  const isAdmin = member.role === "admin" && via === "account";

  const [group, session, members] = await Promise.all([
    getGroup(groupId),
    isUuid(sessionId) ? getSession(groupId, sessionId) : null,
    listMembers(groupId),
  ]);
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

  const tournament = await getTournament(session.id);
  const rules = session.rules ?? group.rules;
  const games = session.matchGames ?? group.matchGames;
  const editable = isAdmin && session.status !== "finished";
  const present = members.filter((m) => session.presentIds.includes(m.id));
  const hostId = session.createdBy ?? member.id;
  // Perkiraan di halaman sesi hanya untuk biaya "rata ke semua peserta hadir" atau iuran flat; rincian lengkap di Patungan.
  const costs =
    session.flatFee !== null || (session.expenses.length > 0 && session.expenses.every((e) => e.splitAll))
      ? {
          items: session.expenses.map((e) => ({ label: e.name, amount: e.amount, paidBy: e.paidBy })),
          hostId,
          roundTo: group.roundTo,
          flatFee: session.flatFee,
        }
      : null;

  return (
    <Page width="wide">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-2">
        <div>
          <Badge tone={STATUS_TONE[session.status]}>{STATUS_LABEL[session.status]}</Badge>
        </div>
        <h1 className="text-title">{formatDateId(session.startsAt)}</h1>
        <p className="text-body">
          {formatTimeRangeId(session.startsAt, session.durationMin)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
      </div>

      <Split
        main={
          <>
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-3">
              {session.status !== "planned" && (
                <ButtonLink href={`/g/${groupId}/sesi/${session.id}/main`} variant={session.status === "running" ? "accent" : "secondary"} size="lg">
                  {session.status === "running" ? "Buka papan skor" : "Lihat match"}
                </ButtonLink>
              )}
              {session.status === "finished" && (
                <ButtonLink href={`/s/${session.shareToken}/recap`} variant="accent" size="lg">
                  Lihat recap
                </ButtonLink>
              )}
              {(tournament || (isAdmin && session.status !== "finished")) && (
                <ButtonLink href={`/g/${groupId}/sesi/${session.id}/turnamen`} variant="secondary" size="lg">
                  {tournament ? `Turnamen: ${tournament.name}` : "Buat turnamen"}
                </ButtonLink>
              )}
              <ButtonLink href={`/g/${groupId}/sesi/${session.id}/patungan`} variant="secondary" size="lg">
                Patungan
              </ButtonLink>
              {session.status !== "planned" && (
                <ButtonLink href={`/g/${groupId}/leaderboard?periode=sesi&sesi=${session.id}`} variant="secondary" size="lg">
                  Klasemen sesi
                </ButtonLink>
              )}
              {isAdmin && (
                <ButtonLink href={`/g/${groupId}/sesi/baru?dari=${session.id}`} variant="secondary" size="lg">
                  Duplikat untuk minggu depan
                </ButtonLink>
              )}
              {isAdmin && <StatusActions groupId={groupId} sessionId={session.id} status={session.status} recapHref={`/s/${session.shareToken}/recap`} />}
            </div>

            {session.status !== "finished" && canPlay(member.role) && (
              <section aria-labelledby="rsvp" className="flex flex-col gap-3" data-testid="rsvp">
                <h2 id="rsvp" className="text-sub">
                  Kamu ikut?
                </h2>
                <RsvpPicker url={`/api/groups/${groupId}/sessions/${session.id}/rsvp`} value={session.rsvp[member.id] ?? null} />
                <dl className="flex flex-col gap-2 text-small" data-testid="rsvp-summary">
                  {(
                    [
                      ["going", "Ikut"],
                      ["maybe", "Mungkin"],
                      ["not_going", "Tidak ikut"],
                    ] as const
                  ).map(([status, label]) => {
                    const who = members.filter((m) => session.rsvp[m.id] === status);
                    return (
                      <div key={status} className="flex gap-2">
                        <dt className="w-24 shrink-0">
                          {label} ({who.length})
                        </dt>
                        <dd className="min-w-0 flex-1">{who.map((m) => m.display_name).join(", ") || "–"}</dd>
                      </div>
                    );
                  })}
                </dl>
                {editable && (
                  <ApplyRsvp
                    url={`/api/groups/${groupId}/sessions/${session.id}/attendees`}
                    goingIds={members.filter((m) => session.rsvp[m.id] === "going").map((m) => m.id)}
                  />
                )}
                <CopyLink url={`${publicEnv().siteUrl}/g/${groupId}/sesi/${session.id}`} label="Salin tautan sesi" done="Tautan sesi disalin. Anggota bisa menjawab ikut / tidak dari tautan ini." />
              </section>
            )}

            <Card className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sub">Detail</h2>
                {editable && (
                  <Link href={`/g/${groupId}/sesi/${session.id}/ubah`} className={buttonClass("secondary")}>
                    Ubah detail
                  </Link>
                )}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-ui">
                <dt>Lapangan</dt>
                <dd>{session.courtCount}</dd>
                <dt>Mode</dt>
                <dd>{PLAY_MODE_LABEL[session.playMode]}</dd>
                <dt>Aturan</dt>
                <dd>
                  {GAMES_LABEL[games]}. {describeRules(rules)}
                </dd>
                {session.note && (
                  <>
                    <dt>Catatan</dt>
                    <dd className="whitespace-pre-line">{session.note}</dd>
                  </>
                )}
              </dl>
            </Card>

            {isAdmin && (
              <DeleteSession
                groupId={groupId}
                sessionId={session.id}
                label={formatDateId(session.startsAt)}
                hasCosts={session.expenses.length > 0 || session.flatFee !== null}
              />
            )}
          </>
        }
        aside={
          <section aria-labelledby="peserta" className="flex flex-col gap-3">
            <h2 id="peserta" className="text-sub">
              Peserta hadir
            </h2>
            {editable ? (
              <AttendanceEditor groupId={groupId} sessionId={session.id} members={playersOf(members)} presentIds={session.presentIds} costs={costs} />
            ) : (
              <>
                <p className="text-ui">{present.length} hadir</p>
                <ul className="flex flex-wrap gap-2">
                  {present.map((m) => (
                    <li key={m.id}>
                      <Badge>{m.display_name}</Badge>
                    </li>
                  ))}
                </ul>
                {costs && <CostEstimate items={costs.items} participants={session.presentIds} hostId={costs.hostId} roundTo={costs.roundTo} flatFee={costs.flatFee} />}
              </>
            )}
          </section>
        }
      />
    </Page>
  );
}
