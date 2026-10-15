import "server-only";
import { HttpError } from "@/lib/http-error";
import { isToken, type MemberPatch } from "@/lib/validation";
import { MEMBER_COLUMNS, type AuthUser, type Member } from "./authz";
import { serviceClient } from "./supabase";

const UNIQUE_VIOLATION = "23505";
const NAME_TAKEN = "Nama ini sudah dipakai di grup. Coba nama lain.";

/** Panggil hanya setelah requireMember. Admin dulu, lalu urut nama. */
export async function listMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await serviceClient()
    .from("members")
    .select(MEMBER_COLUMNS)
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("role", { ascending: true })
    .order("display_name", { ascending: true });
  if (error) throw error;
  return data;
}

/** Nama semua anggota grup, termasuk yang nonaktif (data lama tetap punya nama). */
export async function memberNames(groupId: string): Promise<Record<string, string>> {
  const { data, error } = await serviceClient().from("members").select("id, display_name").eq("group_id", groupId);
  if (error) throw error;
  return Object.fromEntries(data.map((m) => [m.id, m.display_name]));
}

/** Tambah pemain tamu (hanya nama). Panggil hanya setelah requireAdmin. */
export async function addGuest(groupId: string, displayName: string): Promise<Member> {
  const { data, error } = await serviceClient()
    .from("members")
    .insert({ group_id: groupId, display_name: displayName })
    .select(MEMBER_COLUMNS)
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, NAME_TAKEN);
  if (error) throw error;
  return data;
}

/** Ubah grade / peran (pemain, wasit, admin). Panggil hanya setelah requireAdmin. */
export async function updateMember(
  groupId: string,
  actor: Member,
  memberId: string,
  patch: MemberPatch,
): Promise<Member> {
  const db = serviceClient(actor.id);
  const { data: target, error: findError } = await db
    .from("members")
    .select(`${MEMBER_COLUMNS}, groups!inner(owner_id)`)
    .eq("id", memberId)
    .eq("group_id", groupId)
    .eq("is_active", true)
    .maybeSingle();
  if (findError) throw findError;
  if (!target) throw new HttpError(404, "Anggota tidak ditemukan.");

  if (patch.role !== undefined && patch.role !== target.role) {
    if (target.id === actor.id) throw new HttpError(422, "Kamu tidak bisa mengubah peranmu sendiri.");
    if (target.user_id !== null && target.user_id === target.groups.owner_id) {
      throw new HttpError(422, "Pembuat grup selalu admin.");
    }
    if (patch.role !== "member" && target.user_id === null) {
      throw new HttpError(422, `Tamu harus masuk dengan akun sebelum bisa jadi ${patch.role === "admin" ? "admin" : "wasit"}.`);
    }
  }

  const { data, error } = await db
    .from("members")
    .update(patch)
    .eq("id", memberId)
    .eq("group_id", groupId)
    .select(MEMBER_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** Nama profil akun, sebagai saran nama panggilan saat bergabung ke grup. */
export async function profileName(userId: string): Promise<string> {
  const { data } = await serviceClient().from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? "";
}

/**
 * Bergabung lewat tautan undangan. Dengan akun → anggota terhubung ke akun;
 * tanpa akun → tamu, dan claimToken dikembalikan untuk disimpan di cookie httpOnly.
 */
export async function joinGroup(
  groupId: string,
  displayName: string,
  user: AuthUser | null,
): Promise<{ member: Member; claimToken: string | null }> {
  const db = serviceClient();
  if (user) {
    const { data: existing, error: findError } = await db
      .from("members")
      .select(MEMBER_COLUMNS)
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return { member: existing, claimToken: null };
  }

  const { data, error } = await db
    .from("members")
    .insert({ group_id: groupId, display_name: displayName, user_id: user?.id ?? null })
    .select(`${MEMBER_COLUMNS}, claim_token`)
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, NAME_TAKEN);
  if (error) throw error;
  const { claim_token, ...member } = data;
  return { member, claimToken: user ? null : claim_token };
}

export interface ClaimTarget {
  memberId: string;
  displayName: string;
  groupId: string;
  groupName: string;
}

/** Profil tamu yang bisa diklaim lewat token rahasianya (G6), atau null. */
export async function findClaimTarget(token: string): Promise<ClaimTarget | null> {
  if (!isToken(token)) return null;
  const { data, error } = await serviceClient()
    .from("members")
    .select("id, display_name, group_id, groups!inner(name)")
    .eq("claim_token", token)
    .is("user_id", null)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data && { memberId: data.id, displayName: data.display_name, groupId: data.group_id, groupName: data.groups.name };
}

/** Token klaim tamu (untuk tautan yang dibagikan admin). Panggil hanya setelah requireAdmin. */
export async function claimTokenOf(groupId: string, memberId: string): Promise<string | null> {
  const { data, error } = await serviceClient()
    .from("members")
    .select("claim_token")
    .eq("group_id", groupId)
    .eq("id", memberId)
    .is("user_id", null)
    .maybeSingle();
  if (error) throw error;
  return data?.claim_token ?? null;
}

/**
 * Hubungkan profil tamu ke akun (G6): riwayat match & tagihan tetap milik anggota yang sama.
 * Token langsung dicabut (sekali pakai; cookie tamu lama tidak berlaku lagi). Tidak menggabungkan
 * dua profil: bila akun sudah punya profil lain di grup itu → 409.
 */
export async function claimProfile(token: string, user: AuthUser): Promise<ClaimTarget> {
  const target = await findClaimTarget(token);
  if (!target) throw new HttpError(404, "Tautan klaim tidak berlaku atau profil sudah diklaim.");
  const db = serviceClient();
  const { data: existing, error: findError } = await db
    .from("members")
    .select("id")
    .eq("group_id", target.groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) throw new HttpError(409, "Akunmu sudah terdaftar sebagai anggota lain di grup ini. Minta admin menggabungkan secara manual.");
  const { data, error } = await db
    .from("members")
    .update({ user_id: user.id, claim_token: null })
    .eq("id", target.memberId)
    .is("user_id", null)
    .select("id");
  if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, "Akunmu sudah terdaftar sebagai anggota lain di grup ini.");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(409, "Profil ini baru saja diklaim.");
  return target;
}
