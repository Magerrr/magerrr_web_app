import type { Metadata } from "next";
import { GroupList } from "@/components/group-list";
import { ButtonLink, Card, Page, TopBar } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { listMyGroups } from "@/lib/db/groups";

export const metadata: Metadata = { title: "Grup" };

/** Grup pengunjung (akun & tamu), tujuan menu "Grup" di beranda; plus buat grup & jelajahi grup publik. */
export default async function GroupsPage() {
  const user = await getUser();
  const groups = await listMyGroups(user);

  return (
    <Page>
      <TopBar back="/" title="Grup" />
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={user ? "/grup/baru" : "/masuk?next=/grup/baru"}>Buat grup</ButtonLink>
        <ButtonLink href="/jelajah" variant="outline">
          Jelajahi grup publik
        </ButtonLink>
      </div>
      {groups.length > 0 ? (
        <GroupList groups={groups} />
      ) : (
        <Card>
          <p className="text-ui">Kamu belum tergabung di grup mana pun.</p>
        </Card>
      )}
    </Page>
  );
}
