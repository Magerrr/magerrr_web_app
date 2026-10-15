import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Page, TopBar } from "@/components/ui";
import { getMembership, getUser } from "@/lib/db/authz";
import { findGroupByInvite } from "@/lib/db/groups";
import { profileName } from "@/lib/db/members";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Gabung grup" };

export default async function JoinPage({ params }: PageProps<"/gabung/[code]">) {
  const { code } = await params;
  const group = await findGroupByInvite(code);
  if (!group) {
    return (
      <Page width="narrow">
        <TopBar back="/" />
        <Card className="flex flex-col gap-2">
          <h1 className="text-sub">Tautan tidak berlaku</h1>
          <p className="text-ui">Tautan undangan ini sudah diganti atau salah. Minta tautan baru ke admin grup.</p>
        </Card>
      </Page>
    );
  }
  if (await getMembership(group.id)) redirect(`/g/${group.id}`);

  const user = await getUser();
  const suggestedName = user ? await profileName(user.id) : "";

  return (
    <Page width="narrow">
      <TopBar back="/" />
      <div className="flex flex-col gap-2">
        <p className="text-small">Kamu diundang ke</p>
        <h1 className="text-title break-words">
          {group.emoji ? `${group.emoji} ` : ""}
          {group.name}
        </h1>
      </div>
      <JoinForm url={`/api/join/${code}`} defaultName={suggestedName} withAccount={user !== null} />
      {!user && (
        <p className="text-small">
          Punya akun?{" "}
          <Link href={`/masuk?next=${encodeURIComponent(`/gabung/${code}`)}`} className="underline underline-offset-4">
            Masuk dulu
          </Link>{" "}
          agar riwayatmu tersimpan di akun.
        </p>
      )}
    </Page>
  );
}
