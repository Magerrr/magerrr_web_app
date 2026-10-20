import type { Metadata } from "next";
import Link from "next/link";
import { Card, Page, TopBar, textLinkClass } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { listMyGroups } from "@/lib/db/groups";
import { ensureSeriesSessions } from "@/lib/db/session-series";
import { listSessionsOfGroups, type GroupSessionSummary } from "@/lib/db/sessions";
import { toJakartaParts } from "@/lib/time";
import { activeSessions } from "@/lib/session-order";
import { SessionLink } from "../g/[groupId]/session-link";

export const metadata: Metadata = { title: "Semua sesi" };

/** Semua sesi dari grup pengunjung (akun & tamu), tujuan "Lihat semua sesi" di beranda (MAGERRR-13). */
export default async function AllSessionsPage() {
  const groups = await listMyGroups(await getUser());
  await ensureSeriesSessions(groups.map((g) => g.id), toJakartaParts(new Date()).date);
  const sessions = await listSessionsOfGroups(groups.map((g) => g.id));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const now = new Date();
  const active = activeSessions(sessions, now);
  const activeIds = new Set(active.map((s) => s.id));
  const past = sessions.filter((s) => !activeIds.has(s.id));

  return (
    <Page>
      <TopBar back="/" />
      <h1 className="text-title">Semua sesi</h1>
      {groups.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <p className="text-ui">Kamu belum tergabung di grup mana pun.</p>
          <Link href="/jelajah" className={textLinkClass}>
            Jelajahi grup publik
          </Link>
        </Card>
      ) : (
        <>
          <SessionSection id="akan-datang" title="Berlangsung & akan datang" empty="Belum ada sesi yang berlangsung atau terjadwal." sessions={active} groupName={groupName} />
          <SessionSection id="riwayat" title="Riwayat" empty="Belum ada sesi yang sudah lewat." sessions={past} groupName={groupName} />
        </>
      )}
    </Page>
  );
}

function SessionSection({
  id,
  title,
  empty,
  sessions,
  groupName,
}: {
  id: string;
  title: string;
  empty: string;
  sessions: GroupSessionSummary[];
  groupName: Map<string, string>;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-sub">
        {title}
      </h2>
      {sessions.length === 0 ? (
        <Card>
          <p className="text-ui">{empty}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 @xl:grid-cols-2" data-testid={`sessions-${id}`}>
          {sessions.map((s) => (
            <li key={s.id} className="min-w-0">
              <SessionLink groupId={s.groupId} session={s} groupName={groupName.get(s.groupId)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
