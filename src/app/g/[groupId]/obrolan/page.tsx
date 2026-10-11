import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { recentMessages } from "@/lib/db/chat";
import { getGroup } from "@/lib/db/groups";
import { listMembers } from "@/lib/db/members";
import { listSessions } from "@/lib/db/sessions";
import { formatShortDateId, formatTimeRangeId } from "@/lib/format";
import { pageAccess } from "../access";
import { STATUS_LABEL } from "../sesi/status";
import { ChatRoom } from "./chat-room";

export const metadata: Metadata = { title: "Obrolan" };

/** Obrolan grup: hanya anggota (akun atau tamu). Sesi terdekat disematkan di atas. */
export default async function ChatPage({ params }: PageProps<"/g/[groupId]/obrolan">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/obrolan`} />;
  const { member, via } = access.membership;
  const now = new Date();
  const [group, members, sessions, { messages, hasMore }] = await Promise.all([
    getGroup(groupId),
    listMembers(groupId),
    listSessions(groupId),
    recentMessages(groupId),
  ]);
  // Sesi berjalan, atau sesi terencana terdekat yang belum lewat lebih dari 12 jam.
  const pinned =
    sessions.find((s) => s.status === "running") ??
    sessions
      .filter((s) => s.status === "planned" && s.startsAt.getTime() > now.getTime() - 12 * 60 * 60 * 1000)
      .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime())[0];

  return (
    <Page>
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-1">
        <h1 className="text-title">Obrolan</h1>
        <p className="text-small">{members.length} anggota</p>
      </div>
      {pinned && (
        <Link
          href={`/g/${groupId}/sesi/${pinned.id}`}
          className="flex min-h-16 flex-col justify-center gap-1 rounded-2xl border border-ink-black bg-ink-black px-5 py-3 text-cream-paper"
          data-testid="chat-pinned"
        >
          <span className="text-caption">Sesi berikutnya · {STATUS_LABEL[pinned.status]}</span>
          <span className="text-ui">
            {formatShortDateId(pinned.startsAt)} · {formatTimeRangeId(pinned.startsAt, pinned.durationMin)}
            {pinned.venue ? ` · ${pinned.venue}` : ""}
          </span>
        </Link>
      )}
      <ChatRoom
        groupId={groupId}
        me={member.id}
        isAdmin={member.role === "admin" && via === "account"}
        initial={messages}
        initialHasMore={hasMore}
        serverNow={now.toISOString()}
      />
    </Page>
  );
}
