import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { HttpError } from "@/lib/http-error";
import { isUuid } from "@/lib/validation";
import { createAuthClient, serviceClient } from "./supabase";
import type { Database } from "./database.types";

type MemberRow = Database["public"]["Tables"]["members"]["Row"];

/** Kolom anggota yang aman dikirim ke klien (tanpa claim_token). */
export const MEMBER_COLUMNS = "id, group_id, user_id, display_name, role, grade, created_at" as const;
export type Member = Pick<MemberRow, "id" | "group_id" | "user_id" | "display_name" | "role" | "grade" | "created_at">;

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface Membership {
  member: Member;
  user: AuthUser | null;
  /** account = login Supabase; guest = cookie claim_token (tamu tanpa akun) */
  via: "account" | "guest";
}

const GUEST_COOKIE_PREFIX = "mg_tamu_";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 tahun

export const guestCookieName = (groupId: string) => `${GUEST_COOKIE_PREFIX}${groupId}`;

export async function setGuestCookie(groupId: string, claimToken: string): Promise<void> {
  (await cookies()).set(guestCookieName(groupId), claimToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
  });
}

export async function clearGuestCookie(groupId: string): Promise<void> {
  (await cookies()).delete(guestCookieName(groupId));
}

/** Pasangan (groupId, claimToken) dari semua cookie tamu di peramban ini. */
export async function guestCookies(): Promise<{ groupId: string; token: string }[]> {
  return (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith(GUEST_COOKIE_PREFIX))
    .map((c) => ({ groupId: c.name.slice(GUEST_COOKIE_PREFIX.length), token: c.value }))
    .filter((c) => isUuid(c.groupId));
}

/** Pengguna login yang terverifikasi (JWT diperiksa), atau null. */
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** Keanggotaan pengunjung di grup: akun login dulu, lalu cookie tamu. */
export const getMembership = cache(async (groupId: string): Promise<Membership | null> => {
  if (!isUuid(groupId)) return null;
  const db = serviceClient();
  const user = await getUser();

  if (user) {
    const { data, error } = await db
      .from("members")
      .select(MEMBER_COLUMNS)
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (data) return { member: data, user, via: "account" };
  }

  const token = (await cookies()).get(guestCookieName(groupId))?.value;
  if (token) {
    const { data, error } = await db
      .from("members")
      .select(MEMBER_COLUMNS)
      .eq("group_id", groupId)
      .eq("claim_token", token)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (data) return { member: data, user, via: "guest" };
  }
  return null;
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Masuk dulu untuk melanjutkan.");
  return user;
}

/** Anggota grup (akun atau tamu). 401 bila pengunjung tak dikenal, 403 bila bukan anggota. */
export async function requireMember(groupId: string): Promise<Membership> {
  const membership = await getMembership(groupId);
  if (membership) return membership;
  const known = (await getUser()) !== null || (await cookies()).has(guestCookieName(groupId));
  throw known
    ? new HttpError(403, "Kamu bukan anggota grup ini.")
    : new HttpError(401, "Masuk atau buka tautan undangan grup dulu.");
}

/** Admin grup. Admin wajib login dengan akun (tamu tidak bisa jadi admin). */
export async function requireAdmin(groupId: string): Promise<Membership> {
  const membership = await requireMember(groupId);
  if (membership.member.role !== "admin" || membership.via !== "account") {
    throw new HttpError(403, "Hanya admin grup yang boleh melakukan ini.");
  }
  return membership;
}
