import type { Metadata } from "next";
import Link from "next/link";
import { GroupAvatar } from "@/components/group-avatar";
import { Icon } from "@/components/icons";
import { Card, Page, TopBar, buttonClass, inputBase } from "@/components/ui";
import { listPublicGroups } from "@/lib/db/groups";

export const metadata: Metadata = { title: "Jelajahi grup" };

/** Daftar grup publik (MAGERRR-6): siapa pun bisa melihat dan bergabung tanpa tautan undangan. */
export default async function ExplorePage({ searchParams }: PageProps<"/jelajah">) {
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.trim() : "";
  const groups = await listPublicGroups(query);

  return (
    <Page>
      <TopBar back="/" />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Jelajahi grup</h1>
        <p className="text-ui">Grup mabar yang terbuka untuk umum. Gabung tanpa tautan undangan.</p>
      </div>

      <form role="search" className="flex gap-2">
        <label htmlFor="cari-grup" className="sr-only">
          Cari nama grup
        </label>
        <input id="cari-grup" name="q" type="search" defaultValue={query} placeholder="Cari nama grup" maxLength={60} className={`${inputBase} min-w-0 flex-1`} />
        <button type="submit" className={buttonClass("primary", "md", "min-h-13 px-4")} aria-label="Cari">
          <Icon name="search" />
        </button>
      </form>

      {groups.length === 0 ? (
        <Card>
          <p className="text-ui">{query ? `Tidak ada grup publik bernama "${query}".` : "Belum ada grup publik."}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="public-groups">
          {groups.map((g) => (
            <li key={g.id} className="min-w-0">
              <Link
                href={`/jelajah/${g.id}`}
                className="flex h-full min-h-16 items-center gap-4 rounded-2xl border border-ink-black bg-pure-white p-4 hover:bg-cream-paper"
              >
                <GroupAvatar name={g.name} emoji={g.emoji} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-lead">{g.name}</span>
                  <span className="text-small">{g.memberCount} anggota</span>
                </span>
                <Icon name="chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
