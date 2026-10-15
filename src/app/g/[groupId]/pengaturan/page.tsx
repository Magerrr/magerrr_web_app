import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { pageAccess } from "../access";
import { DeleteGroup } from "./delete-group";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Pengaturan grup" };

export default async function SettingsPage({ params }: PageProps<"/g/[groupId]/pengaturan">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "admin");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/pengaturan`} />;
  const group = await getGroup(groupId);

  return (
    <Page width="narrow">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Pengaturan grup</h1>
        <p className="text-ui">Mengubah aturan tidak mengubah skor yang sudah tercatat. Klasemen dihitung ulang otomatis.</p>
      </div>
      <SettingsForm group={group} />
      <DeleteGroup groupId={groupId} groupName={group.name} />
    </Page>
  );
}
