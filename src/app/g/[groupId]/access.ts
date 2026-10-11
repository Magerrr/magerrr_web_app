import "server-only";
import { getMembership, getUser, guestCookieName, type Membership } from "@/lib/db/authz";
import { cookies } from "next/headers";

/** Hasil cek akses halaman grup; halaman merender <NoAccess> bila `denied`. */
export async function pageAccess(
  groupId: string,
  need: "member" | "admin",
): Promise<{ membership: Membership; denied?: never } | { denied: "unknown" | "not-member" | "not-admin" }> {
  const membership = await getMembership(groupId);
  if (!membership) {
    const known = (await getUser()) !== null || (await cookies()).has(guestCookieName(groupId));
    return { denied: known ? "not-member" : "unknown" };
  }
  if (need === "admin" && (membership.member.role !== "admin" || membership.via !== "account")) {
    return { denied: "not-admin" };
  }
  return { membership };
}
