import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { getSession } from "@/lib/db/sessions";
import { toJakartaParts } from "@/lib/time";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../../access";
import { SessionForm } from "../../session-form";
import { toOfferedMode } from "../../status";

export const metadata: Metadata = { title: "Ubah sesi" };

export default async function EditSessionPage({ params }: PageProps<"/g/[groupId]/sesi/[sessionId]/ubah">) {
  const { groupId, sessionId } = await params;
  const access = await pageAccess(groupId, "admin");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/sesi/${sessionId}/ubah`} />;

  const [group, session] = await Promise.all([getGroup(groupId), isUuid(sessionId) ? getSession(groupId, sessionId) : null]);
  if (!session || session.status === "finished") redirect(`/g/${groupId}/sesi/${sessionId}`);
  const { date, time } = toJakartaParts(session.startsAt);

  return (
    <Page width="narrow">
      <TopBar back={`/g/${groupId}/sesi/${session.id}`} title={group.name} />
      <h1 className="text-title">Ubah sesi</h1>
      <SessionForm
        groupId={groupId}
        sessionId={session.id}
        defaults={{
          date,
          time,
          durationMin: session.durationMin ?? 120,
          venue: session.venue,
          courtCount: session.courtCount,
          playMode: toOfferedMode(session.playMode),
          rules: session.rules ?? group.rules,
          matchGames: session.matchGames ?? group.matchGames,
          note: session.note,
        }}
      />
    </Page>
  );
}
