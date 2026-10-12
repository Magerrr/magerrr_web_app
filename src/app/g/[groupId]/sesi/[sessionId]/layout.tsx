import { getMembership } from "@/lib/db/authz";
import { listSessions } from "@/lib/db/sessions";
import { SessionLink } from "../../session-link";
import { SessionSplit } from "./session-split";

/**
 * Daftar sesi untuk split view di halaman detail sesi (lihat SessionSplit). Hanya anggota yang mendapat daftar;
 * akses ke isi halaman tetap dicek tiap halaman (pageAccess).
 */
export default async function SessionLayout({ children, params }: LayoutProps<"/g/[groupId]/sesi/[sessionId]">) {
  const { groupId, sessionId } = await params;
  if (!(await getMembership(groupId))) return children;
  const sessions = await listSessions(groupId);

  return (
    <SessionSplit
      detailHref={`/g/${groupId}/sesi/${sessionId}`}
      list={
        <div className="flex flex-col gap-3 p-4">
          <h2 className="px-1 text-sub">Sesi</h2>
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <SessionLink groupId={groupId} session={s} current={s.id === sessionId} testId={false} compact />
              </li>
            ))}
          </ul>
        </div>
      }
    >
      {children}
    </SessionSplit>
  );
}
