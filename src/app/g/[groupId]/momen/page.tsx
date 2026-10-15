import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { isGroupAdmin } from "@/lib/db/authz";
import { getGroup } from "@/lib/db/groups";
import { listMoments } from "@/lib/db/moments";
import { listSessions } from "@/lib/db/sessions";
import { formatShortDateId } from "@/lib/format";
import { pageAccess } from "../access";
import { MomentGallery, MomentUpload } from "./moments";

export const metadata: Metadata = { title: "Momen" };

/** Galeri foto momen grup (MAGERRR-9): semua anggota bisa mengunggah; hapus oleh pengunggah atau admin. */
export default async function MomentsPage({ params }: PageProps<"/g/[groupId]/momen">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/momen`} />;
  const [group, moments, sessions] = await Promise.all([getGroup(groupId), listMoments(groupId), listSessions(groupId)]);
  const sessionOptions = sessions.slice(0, 10).map((s) => ({ id: s.id, label: `${formatShortDateId(s.startsAt)}${s.venue ? ` · ${s.venue}` : ""}` }));
  const sessionLabel = Object.fromEntries(sessionOptions.map((s) => [s.id, s.label]));

  return (
    <Page width="wide">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-1">
        <h1 className="text-title">Momen</h1>
        <p className="text-ui">Foto mabar bareng grup. Hanya anggota yang bisa melihat{group.isPublic ? "; foto terbaru jadi gambar grup di Jelajahi bila belum ada sampul" : ""}.</p>
      </div>
      <MomentUpload groupId={groupId} sessions={sessionOptions} />
      <MomentGallery
        groupId={groupId}
        moments={moments.map((m) => ({
          ...m,
          date: formatShortDateId(new Date(m.createdAt)),
          session: m.sessionId ? (sessionLabel[m.sessionId] ?? null) : null,
          canDelete: m.memberId === access.membership.member.id || isGroupAdmin(access.membership),
        }))}
      />
    </Page>
  );
}
