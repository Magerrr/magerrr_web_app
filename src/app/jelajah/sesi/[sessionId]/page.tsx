import type { Metadata } from "next";
import { Card, Notice, Page, TopBar } from "@/components/ui";
import { canPlay } from "@/lib/core/roles";
import { getMembership, getUser } from "@/lib/db/authz";
import { profileName } from "@/lib/db/members";
import { findPublicSession } from "@/lib/db/sessions";
import { formatDateId, formatTimeRangeId } from "@/lib/format";
import { IkutForm } from "./ikut-form";

export const metadata: Metadata = { title: "Ikut sesi" };

/** Pratinjau sesi publik + konfirmasi ikut. Sesi selesai / lewat / tidak tampil → pesan, tanpa membocorkan isinya. */
export default async function PublicSessionPage({ params }: PageProps<"/jelajah/sesi/[sessionId]">) {
  const { sessionId } = await params;
  const session = await findPublicSession(sessionId);
  if (!session) {
    return (
      <Page width="narrow">
        <TopBar back="/jelajah" />
        <Card className="flex flex-col gap-2">
          <h1 className="text-sub">Sesi tidak tersedia</h1>
          <p className="text-ui">Sesi ini sudah selesai, sudah lewat, atau tidak dibuka untuk umum.</p>
        </Card>
      </Page>
    );
  }

  const membership = await getMembership(session.groupId);
  const isReferee = membership !== null && !canPlay(membership.member.role);
  const user = await getUser();
  const suggestedName = !membership && user ? await profileName(user.id) : "";

  return (
    <Page width="narrow">
      <TopBar back="/jelajah" />
      <div className="flex flex-col gap-1">
        <p className="text-small">{session.groupName}</p>
        <h1 className="text-title break-words">{formatDateId(session.startsAt)}</h1>
        <p className="text-ui">
          {formatTimeRangeId(session.startsAt, session.durationMin)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
        <p className="text-small">
          {session.courtCount} lapangan · {session.goingCount} orang ikut
        </p>
      </div>
      {isReferee ? (
        <Notice>Kamu wasit di grup ini. Wasit tidak ikut bermain, jadi tidak perlu menjawab ikut atau tidak.</Notice>
      ) : (
        <IkutForm
          sessionId={session.id}
          groupName={session.groupName}
          defaultName={suggestedName}
          withAccount={user !== null}
          isMember={membership !== null}
        />
      )}
    </Page>
  );
}
