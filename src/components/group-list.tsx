import Link from "next/link";
import { GroupAvatar } from "@/components/group-avatar";
import { LinkPending } from "@/components/button";
import { PENDING_LINK } from "@/components/button-class";
import { Badge } from "@/components/ui";
import type { GroupSummary } from "@/lib/db/groups";

/** Daftar grup pengunjung (akun & tamu); `path` = sub-halaman grup tujuan, mis. "/obrolan". */
export function GroupList({ groups, path = "" }: { groups: GroupSummary[]; path?: string }) {
  return (
    <ul className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-1">
      {groups.map((group) => (
        <li key={group.id} className="min-w-0">
          <Link
            href={`/g/${group.id}${path}`}
            className={`${PENDING_LINK} flex h-full min-h-16 items-center gap-4 rounded-2xl border border-ink-black bg-pure-white p-4 hover:bg-cream-paper`}
          >
            <GroupAvatar name={group.name} emoji={group.emoji} logoUrl={group.logoUrl} theme={group.theme} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-lead">{group.name}</span>
              <span className="truncate text-small">sebagai {group.memberName}</span>
            </span>
            <LinkPending />
            {group.role === "admin" && <Badge tone="accent">Admin</Badge>}
            {group.role === "referee" && group.via === "account" && <Badge tone="sunshine">Wasit</Badge>}
            {group.via === "guest" && <Badge tone="outline">Tamu</Badge>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
