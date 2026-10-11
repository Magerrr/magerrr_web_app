import type { Metadata } from "next";
import { MatchFormPage } from "../form-page";

export const metadata: Metadata = { title: "Ubah skor" };

export default async function EditMatchPage({ params }: PageProps<"/g/[groupId]/sesi/[sessionId]/catat/[matchId]">) {
  const { groupId, sessionId, matchId } = await params;
  return <MatchFormPage groupId={groupId} sessionId={sessionId} matchId={matchId} />;
}
