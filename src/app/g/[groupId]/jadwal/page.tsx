import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { listTemplates } from "@/lib/db/session-templates";
import { pageAccess } from "../access";
import { TemplateManager } from "./template-manager";

export const metadata: Metadata = { title: "Jadwal mingguan" };

export default async function SchedulePage({ params }: PageProps<"/g/[groupId]/jadwal">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "admin");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/jadwal`} />;
  const [group, templates] = await Promise.all([getGroup(groupId), listTemplates(groupId)]);

  return (
    <Page width="narrow">
      <TopBar back={`/g/${groupId}/pengaturan`} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Jadwal mingguan</h1>
        <p className="text-ui">
          Sesi berstatus Rencana dibuat otomatis sebelum harinya, dengan peserta dari sesi sebelumnya dan RSVP langsung terbuka. Waktu mengikuti WIB.
          Menjeda atau menghapus jadwal tidak menghapus sesi yang sudah dibuat.
        </p>
      </div>
      <TemplateManager groupId={groupId} templates={templates} defaultPlayMode={group.defaultPlayMode} />
    </Page>
  );
}
