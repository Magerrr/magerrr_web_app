import "server-only";
import { canOfficiate, getMembership, getUser, guestCookieName, isGroupAdmin, type Membership } from "@/lib/db/authz";
import { cookies } from "next/headers";

/** Hasil cek akses halaman grup; halaman merender <NoAccess> bila `denied`. `official` = admin atau wasit. */
export async function pageAccess(
  groupId: string,
  need: "member" | "admin" | "official",
): Promise<{ membership: Membership; denied?: never } | { denied: "unknown" | "not-member" | "not-admin" }> {
  const membership = await getMembership(groupId);
  if (!membership) {
    const known = (await getUser()) !== null || (await cookies()).has(guestCookieName(groupId));
    return { denied: known ? "not-member" : "unknown" };
  }
  if (need === "admin" && !isGroupAdmin(membership)) return { denied: "not-admin" };
  if (need === "official" && !canOfficiate(membership)) return { denied: "not-admin" };
  return { membership };
}
