import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupAvatar } from "@/components/group-avatar";
import { Card, Page, TopBar } from "@/components/ui";
import { getMembership, getUser } from "@/lib/db/authz";
import { findPublicGroup } from "@/lib/db/groups";
import { profileName } from "@/lib/db/members";
import { JoinForm } from "../../gabung/[code]/join-form";

export const metadata: Metadata = { title: "Gabung grup" };

/** Pratinjau grup publik + gabung terbuka (MAGERRR-6). Grup privat / tidak ada → pesan, tanpa membocorkan isinya. */
export default async function PublicGroupPage({ params }: PageProps<"/jelajah/[groupId]">) {
  const { groupId } = await params;
  const group = await findPublicGroup(groupId);
  if (!group) {
    return (
      <Page width="narrow">
        <TopBar back="/jelajah" />
        <Card className="flex flex-col gap-2">
          <h1 className="text-sub">Grup tidak ditemukan</h1>
          <p className="text-ui">Grup ini privat atau sudah tidak ada. Minta tautan undangan ke admin grup.</p>
        </Card>
      </Page>
    );
  }
  if (await getMembership(group.id)) redirect(`/g/${group.id}`);

  const user = await getUser();
  const suggestedName = user ? await profileName(user.id) : "";
  const self = `/jelajah/${group.id}`;

  return (
    <Page width="narrow">
      <TopBar back="/jelajah" />
      {group.coverUrl && (
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl border border-ink-black bg-sandstone">
          <Image src={group.coverUrl} alt="" fill unoptimized priority sizes="(min-width: 640px) 576px, 100vw" className="object-cover" />
        </div>
      )}
      <div className="flex items-center gap-4">
        <GroupAvatar name={group.name} emoji={group.emoji} logoUrl={group.logoUrl} theme={group.theme} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-small">Grup publik · {group.memberCount} anggota</p>
          <h1 className="text-title break-words">{group.name}</h1>
        </div>
      </div>
      <JoinForm url={`/api/groups/${group.id}/join`} defaultName={suggestedName} withAccount={user !== null} />
      {!user && (
        <p className="text-small">
          Punya akun?{" "}
          <Link href={`/masuk?next=${encodeURIComponent(self)}`} className="underline underline-offset-4">
            Masuk dulu
          </Link>{" "}
          agar riwayatmu tersimpan di akun.
        </p>
      )}
    </Page>
  );
}
