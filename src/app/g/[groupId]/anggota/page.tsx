import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { getGroup, getInviteCode } from "@/lib/db/groups";
import { listMembers } from "@/lib/db/members";
import { publicEnv } from "@/lib/env";
import { pageAccess } from "../access";
import { AddGuestForm, InviteCard, MemberList } from "./member-admin";

export const metadata: Metadata = { title: "Anggota" };

export default async function MembersPage({ params }: PageProps<"/g/[groupId]/anggota">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/anggota`} />;

  const { member, via } = access.membership;
  const isAdmin = member.role === "admin" && via === "account";
  const [group, members, inviteCode] = await Promise.all([
    getGroup(groupId),
    listMembers(groupId),
    isAdmin ? getInviteCode(groupId) : Promise.resolve(null),
  ]);

  return (
    <Page>
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <h1 className="text-title">Anggota</h1>
      {inviteCode && (
        <InviteCard groupId={groupId} groupName={group.name} inviteUrl={`${publicEnv().siteUrl}/gabung/${inviteCode}`} />
      )}
      {isAdmin && <AddGuestForm groupId={groupId} />}
      <MemberList
        groupId={groupId}
        members={members}
        selfId={member.id}
        ownerUserId={group.ownerId}
        editable={isAdmin}
      />
    </Page>
  );
}
