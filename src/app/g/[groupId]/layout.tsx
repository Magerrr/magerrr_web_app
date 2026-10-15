import Link from "next/link";
import { getMembership, getUser } from "@/lib/db/authz";
import { unreadCount } from "@/lib/db/chat";
import { getGroup, listMyGroups } from "@/lib/db/groups";
import { GroupNav } from "./group-nav";
import { GroupTabs } from "./group-tabs";

const avatar = (g: { name: string; emoji: string | null }) => g.emoji ?? g.name.slice(0, 1).toUpperCase();

/**
 * Navigasi grup: sidebar di desktop (lg ≥ 1024px), rail di tablet (GroupTabs); ponsel tanpa bar bawah, menu ada di Beranda.
 * Hanya tampilan: akses tetap dicek tiap halaman (pageAccess) karena layout tidak dirender ulang saat pindah halaman.
 * Pengunjung yang bukan anggota mendapat halaman saja (NoAccess) tanpa sidebar.
 */
export default async function GroupLayout({ children, params }: LayoutProps<"/g/[groupId]">) {
  const { groupId } = await params;
  const membership = await getMembership(groupId);
  if (!membership) return children;

  const { member, via } = membership;
  const user = await getUser();
  const [group, unread, groups] = await Promise.all([getGroup(groupId), unreadCount(groupId, member.id), listMyGroups(user)]);
  const tabs = { groupId, memberId: member.id, canCreate: member.role === "admin" && via === "account" };
  const others = groups.filter((g) => g.id !== groupId);

  return (
    <div className="sm:flex lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <GroupTabs {...tabs} />
      <aside
        aria-label="Navigasi samping"
        className="sticky top-0 hidden h-dvh flex-col gap-6 self-start overflow-y-auto border-r border-ink-black bg-pure-white px-3 py-6 lg:flex"
      >
        <a href="#konten" className="sr-only focus:not-sr-only focus:flex focus:min-h-11 focus:items-center focus:rounded-full focus:px-4 focus:text-ui">
          Langsung ke konten
        </a>
        <Link href="/" className="flex min-h-11 items-center self-start px-4 text-lead">
          Magerrr
        </Link>

        <div className="flex items-center gap-3 px-2">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink-black bg-cream-paper text-lead" aria-hidden="true">
            {avatar(group)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-ui font-medium break-words">{group.name}</span>
            <span className="truncate text-caption">{member.display_name}</span>
          </span>
        </div>

        <GroupNav groupId={groupId} isAdmin={member.role === "admin" && via === "account"} unread={unread} />

        {others.length > 0 && (
          <section aria-labelledby="grup-lain" className="flex flex-col gap-1">
            <h2 id="grup-lain" className="px-4 pb-1 text-caption font-medium">
              Grup lain
            </h2>
            <ul className="flex flex-col gap-1">
              {others.map((g) => (
                <li key={g.id}>
                  <Link href={`/g/${g.id}`} className="flex min-h-11 items-center gap-3 rounded-full px-4 text-ui hover:bg-sandstone">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sandstone text-small" aria-hidden="true">
                      {avatar(g)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-auto flex flex-col gap-1 border-t border-hairline-mist pt-4">
          {user ? (
            <form action="/auth/keluar" method="post">
              <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center rounded-full px-4 text-ui hover:bg-fresh-grass/25">
                Keluar
              </button>
            </form>
          ) : (
            <Link href={`/masuk?next=${encodeURIComponent(`/g/${groupId}`)}`} className="flex min-h-11 items-center rounded-full px-4 text-ui hover:bg-sandstone">
              Masuk
            </Link>
          )}
        </div>
      </aside>

      <div className="min-w-0 sm:flex-1">
        {children}
      </div>
    </div>
  );
}
