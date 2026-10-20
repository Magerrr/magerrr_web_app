import type { Metadata } from "next";
import { GroupList } from "@/components/group-list";
import { ButtonLink, Card, Page, TopBar } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { listMyGroups } from "@/lib/db/groups";

export const metadata: Metadata = { title: "Obrolan" };

/** Obrolan ada per grup; halaman ini memilih grup, tujuan menu "Obrolan" di beranda. */
export default async function ChatsPage() {
  const groups = await listMyGroups(await getUser());

  return (
    <Page>
      <TopBar back="/" />
      <h1 className="text-title">Obrolan</h1>
      {groups.length > 0 ? (
        <>
          <p className="text-ui">Pilih grup untuk membuka obrolannya.</p>
          <GroupList groups={groups} path="/obrolan" />
        </>
      ) : (
        <Card className="flex flex-col gap-4">
          <p className="text-ui">Gabung grup dulu untuk mulai mengobrol.</p>
          <ButtonLink href="/jelajah" variant="outline" className="self-start">
            Jelajahi grup publik
          </ButtonLink>
        </Card>
      )}
    </Page>
  );
}
