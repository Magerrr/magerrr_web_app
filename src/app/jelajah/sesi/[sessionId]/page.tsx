import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink, Card, Page, TopBar } from "@/components/ui";
import { findPublicSessionPreview } from "@/lib/db/sessions";
import { formatDateId, formatTimeRangeId } from "@/lib/format";
import { PLAY_MODE_LABEL } from "../../../g/[groupId]/sesi/status";

export const metadata: Metadata = { title: "Pratinjau sesi" };

/** Pratinjau sesi publik tanpa login (#15-D). Hanya baca; privat, tersembunyi, atau tidak ada → 404 tanpa membedakan. */
export default async function PublicSessionPreviewPage({ params }: PageProps<"/jelajah/sesi/[sessionId]">) {
  const { sessionId } = await params;
  const session = await findPublicSessionPreview(sessionId);
  if (!session) notFound();

  const rows: [string, string][] = [
    ["Tanggal", formatDateId(session.startsAt)],
    ["Jam", `${formatTimeRangeId(session.startsAt, session.durationMin)} WIB`],
    ...(session.venue ? ([["Tempat", session.venue]] as [string, string][]) : []),
    ["Lapangan", `${session.courtCount} lapangan`],
    ["Mode main", PLAY_MODE_LABEL[session.playMode]],
    ["Yang ikut", `${session.goingCount} orang`],
  ];

  return (
    <Page width="narrow">
      <TopBar back="/jelajah?tab=sesi" />
      <div className="flex flex-col gap-1">
        <p className="text-small">Sesi publik · Rencana</p>
        <h1 className="text-title break-words">
          {session.groupEmoji ? `${session.groupEmoji} ` : ""}
          {session.groupName}
        </h1>
      </div>
      <Card>
        <dl className="flex flex-col gap-3 text-ui">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-small">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <ButtonLink href={`/jelajah/${session.groupId}`} variant="primary" size="lg">
        Lihat grup
      </ButtonLink>
    </Page>
  );
}
