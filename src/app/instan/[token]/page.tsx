import type { Metadata } from "next";
import { Card, Notice, Page } from "@/components/ui";
import { INSTANT_EXPIRED_MESSAGE, INSTANT_FULL_MESSAGE } from "@/lib/core/instant-join";
import { findInstantPreview } from "@/lib/db/instant";
import { formatDateId, formatTimeRangeId } from "@/lib/format";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Ikut mabar", robots: { index: false } };

/** Halaman publik Mabar Instan (tanpa login). Tiga keadaan: valid → form, expired / penuh → pesan. Token salah = expired. */
export default async function InstantJoinPage({ params }: PageProps<"/instan/[token]">) {
  const { token } = await params;
  const session = await findInstantPreview(token);

  if (!session) {
    return (
      <Page width="narrow">
        <Card className="flex flex-col gap-2">
          <h1 className="text-sub">Tautan tidak berlaku</h1>
          <p className="text-ui">{INSTANT_EXPIRED_MESSAGE}</p>
        </Card>
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <div className="flex flex-col gap-1">
        <p className="text-small">{session.groupName}</p>
        <h1 className="text-title break-words">{formatDateId(session.startsAt)}</h1>
        <p className="text-ui">
          {formatTimeRangeId(session.startsAt, session.durationMin)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
        <p className="text-small" data-testid="instan-slot">
          {session.slotCount === null ? `${session.taken} orang ikut` : `${session.taken}/${session.slotCount} slot terisi`}
        </p>
      </div>
      {session.state === "valid" && <JoinForm token={token} />}
      {session.state === "full" && <Notice tone="error">{INSTANT_FULL_MESSAGE}</Notice>}
      {session.state === "expired" && <Notice tone="error">{INSTANT_EXPIRED_MESSAGE}</Notice>}
    </Page>
  );
}
