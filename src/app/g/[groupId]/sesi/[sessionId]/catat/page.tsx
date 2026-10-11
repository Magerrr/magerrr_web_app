import type { Metadata } from "next";
import { MatchFormPage } from "./form-page";

export const metadata: Metadata = { title: "Catat match" };

export default async function NewMatchPage({ params }: PageProps<"/g/[groupId]/sesi/[sessionId]/catat">) {
  const { groupId, sessionId } = await params;
  return <MatchFormPage groupId={groupId} sessionId={sessionId} />;
}
