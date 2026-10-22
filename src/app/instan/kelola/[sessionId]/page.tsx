import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageAccess } from "@/app/g/[groupId]/access";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { listMembers } from "@/lib/db/members";
import { findSessionGroupId, getSession } from "@/lib/db/sessions";
import { publicEnv } from "@/lib/env";
import { formatDateId, formatTimeRangeId } from "@/lib/format";
import { isUuid } from "@/lib/validation";
import { HostPanel } from "./host-panel";

export const metadata: Metadata = { title: "Kelola Mabar Instan", robots: { index: false } };

/** Dashboard host Mabar Instan: peserta (nama saja), tautan gabung, buat tautan baru, batalkan. Hanya admin grup tersembunyinya. */
export default async function InstantHostPage({ params }: PageProps<"/instan/kelola/[sessionId]">) {
  const { sessionId } = await params;
  const here = `/instan/kelola/${sessionId}`;
  if (!(await getUser())) redirect(`/masuk?next=${here}`);
  const groupId = isUuid(sessionId) ? await findSessionGroupId(sessionId) : null;
  if (!groupId) return <NoAccess reason="unknown" next={here} />;
  const access = await pageAccess(groupId, "admin");
  if (access.denied) return <NoAccess reason={access.denied} next={here} />;

  const [session, members] = await Promise.all([getSession(groupId, sessionId), listMembers(groupId)]);
  if (!session) return <NoAccess reason="unknown" next={here} />;
  const joined = new Set(session.presentIds);
  for (const [id, answer] of Object.entries(session.rsvp)) if (answer === "going") joined.add(id);
  const names = members.filter((m) => joined.has(m.id)).map((m) => m.display_name);

  return (
    <Page width="narrow">
      <TopBar back="/" />
      <div className="flex flex-col gap-1">
        <h1 className="text-title break-words">{formatDateId(session.startsAt)}</h1>
        <p className="text-ui">
          {formatTimeRangeId(session.startsAt, session.durationMin)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
      </div>
      <HostPanel
        groupId={groupId}
        sessionId={sessionId}
        joinUrl={`${publicEnv().siteUrl}/instan/${session.shareToken}`}
        names={names}
        finished={session.status === "finished"}
      />
    </Page>
  );
}
