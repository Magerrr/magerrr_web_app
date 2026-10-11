import "server-only";
import { cache } from "react";
import { buildRecap, type Recap } from "@/lib/core/recap";
import { publicEnv } from "@/lib/env";
import { getMembership } from "./authz";
import { coreExpense, loadBill } from "./bill";
import { getGroup, type GroupSettings } from "./groups";
import { loadSessionMatches, type SessionMatch } from "./matches";
import { memberNames } from "./members";
import { findSessionByShareToken, type SessionDetail } from "./sessions";

export interface RecapAccess {
  session: SessionDetail;
  group: GroupSettings;
  isMember: boolean;
  isAdmin: boolean;
}

/**
 * Akses recap lewat token (R5): anggota grup selalu boleh; pengunjung lain hanya bila
 * `recap_public` aktif. Null = tampilkan 404 (tidak membocorkan keberadaan sesi).
 */
export const recapAccess = cache(async (token: string): Promise<RecapAccess | null> => {
  const session = await findSessionByShareToken(token);
  if (!session) return null;
  const membership = await getMembership(session.groupId);
  if (!session.recapPublic && !membership) return null;
  return {
    session,
    group: await getGroup(session.groupId),
    isMember: membership !== null,
    isAdmin: membership?.member.role === "admin" && membership.via === "account",
  };
});

export interface RecapData {
  recap: Recap;
  names: Record<string, string>;
  /** peserta hadir */
  participants: string[];
  /** match selesai/void urut seq (R1) */
  matches: SessionMatch[];
  publicUrl: string;
}

export async function loadRecap(group: GroupSettings, session: SessionDetail): Promise<RecapData> {
  const [matches, names, bill] = await Promise.all([loadSessionMatches(session, group), memberNames(group.id), loadBill(session)]);
  const recap = buildRecap(
    {
      id: session.id,
      scoring: group.scoring,
      participants: bill.participants,
      hostId: bill.hostId,
      roundTo: group.roundTo,
      settlements: bill.settlements,
    },
    matches,
    bill.expenses.map(coreExpense),
  );
  return {
    recap,
    names,
    participants: bill.participants,
    matches: matches.filter((m) => m.status !== "running"),
    publicUrl: `${publicEnv().siteUrl}/s/${session.shareToken}/recap`,
  };
}
