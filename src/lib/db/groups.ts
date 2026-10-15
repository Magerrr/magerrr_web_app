import "server-only";
import { randomBytes } from "node:crypto";
import type { GameRules } from "@/lib/core/rules";
import type { ScoringConfig } from "@/lib/core/standings";
import type { GroupTheme } from "@/lib/group-theme";
import { isToken, isUuid, type GroupSettingsPatch } from "@/lib/validation";
import { guestCookies, type AuthUser } from "./authz";
import { MEDIA_BUCKET, groupImageUrl, groupMediaPaths } from "./group-media";
import { QRIS_BUCKET } from "./payments";
import type { Database } from "./database.types";
import { serviceClient } from "./supabase";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type PlayMode = Database["public"]["Enums"]["play_mode"];

/** Identitas tampilan grup (MAGERRR-8): ikon, logo, sampul, warna tema. */
export interface GroupLook {
  id: string;
  name: string;
  emoji: string | null;
  theme: GroupTheme;
  logoUrl: string | null;
  coverUrl: string | null;
}

const LOOK_COLUMNS = "id, name, emoji, theme, logo_path, cover_path" as const;

function toLook(row: Pick<GroupRow, "id" | "name" | "emoji" | "theme" | "logo_path" | "cover_path">): GroupLook {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    theme: row.theme as GroupTheme,
    logoUrl: groupImageUrl(row.id, "logo", row.logo_path),
    coverUrl: groupImageUrl(row.id, "cover", row.cover_path),
  };
}

export interface GroupSettings extends GroupLook {
  ownerId: string;
  rules: GameRules;
  matchGames: 1 | 3 | 5;
  scoring: ScoringConfig;
  roundTo: 1 | 500 | 1000;
  defaultPlayMode: PlayMode;
  /** tampil di /jelajah dan bisa digabung tanpa tautan undangan (MAGERRR-6) */
  isPublic: boolean;
}

const GROUP_COLUMNS =
  "id, name, emoji, theme, logo_path, cover_path, owner_id, rules, match_games, scoring, round_to, default_play_mode, is_public" as const;

function toSettings(row: Omit<GroupRow, "invite_code" | "created_at">): GroupSettings {
  return {
    ...toLook(row),
    ownerId: row.owner_id,
    rules: row.rules as unknown as GameRules,
    matchGames: row.match_games as GroupSettings["matchGames"],
    scoring: row.scoring as unknown as ScoringConfig,
    roundTo: row.round_to as GroupSettings["roundTo"],
    defaultPlayMode: row.default_play_mode,
    isPublic: row.is_public,
  };
}

export const newToken = () => randomBytes(16).toString("hex"); // 128 bit

/** Panggil hanya setelah requireMember/requireAdmin. */
export async function getGroup(groupId: string): Promise<GroupSettings> {
  const { data, error } = await serviceClient().from("groups").select(GROUP_COLUMNS).eq("id", groupId).single();
  if (error) throw error;
  return toSettings(data);
}

/** Panggil hanya setelah requireAdmin. */
export async function getInviteCode(groupId: string): Promise<string> {
  const { data, error } = await serviceClient().from("groups").select("invite_code").eq("id", groupId).single();
  if (error) throw error;
  return data.invite_code;
}

export interface GroupSummary extends GroupLook {
  role: "admin" | "referee" | "member";
  via: "account" | "guest";
  memberName: string;
}

/** Grup milik pengunjung: lewat akun login dan lewat cookie tamu. */
export async function listMyGroups(user: AuthUser | null): Promise<GroupSummary[]> {
  const db = serviceClient();
  const select = `role, display_name, groups!inner(${LOOK_COLUMNS})` as const;
  const result: GroupSummary[] = [];

  if (user) {
    const { data, error } = await db.from("members").select(select).eq("user_id", user.id).eq("is_active", true);
    if (error) throw error;
    for (const m of data) {
      result.push({ ...toLook(m.groups), role: m.role, via: "account", memberName: m.display_name });
    }
  }

  const guests = (await guestCookies()).filter((g) => !result.some((r) => r.id === g.groupId) && isToken(g.token));
  if (guests.length > 0) {
    const { data, error } = await db
      .from("members")
      .select(select)
      .in("claim_token", guests.map((g) => g.token))
      .eq("is_active", true);
    if (error) throw error;
    for (const m of data) {
      if (guests.some((g) => g.groupId === m.groups.id)) {
        result.push({ ...toLook(m.groups), role: m.role, via: "guest", memberName: m.display_name });
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function createGroup(user: AuthUser, input: { name: string; emoji: string | null }): Promise<string> {
  const db = serviceClient();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;

  const { data, error } = await db.rpc("create_group", {
    p_owner: user.id,
    p_name: input.name,
    p_emoji: input.emoji as string,
    p_display_name: profile.display_name,
  });
  if (error) throw error;
  return data;
}

export async function updateGroup(groupId: string, actorMemberId: string, patch: GroupSettingsPatch): Promise<void> {
  const update: Database["public"]["Tables"]["groups"]["Update"] = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.emoji !== undefined) update.emoji = patch.emoji;
  if (patch.rules) update.rules = { ...patch.rules };
  if (patch.matchGames) update.match_games = patch.matchGames;
  if (patch.scoring) update.scoring = { ...patch.scoring };
  if (patch.roundTo) update.round_to = patch.roundTo;
  if (patch.defaultPlayMode) update.default_play_mode = patch.defaultPlayMode;
  if (patch.isPublic !== undefined) update.is_public = patch.isPublic;
  if (patch.theme) update.theme = patch.theme;

  // Trigger audit_group_rules mencatat perubahan aturan beserta pelakunya.
  const { error } = await serviceClient(actorMemberId).from("groups").update(update).eq("id", groupId);
  if (error) throw error;
}

/**
 * Hapus grup beserta semua datanya (anggota, sesi, match, patungan, obrolan, audit) lewat RPC `delete_group`
 * (urutan hapus eksplisit, lihat migrasi 0015). Gambar QRIS anggota serta logo/sampul/momen grup dihapus dari
 * Storage setelah baris database hilang (best effort: gagal hapus berkas tidak membatalkan penghapusan grup).
 * Panggil hanya setelah requireAdmin.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const db = serviceClient();
  const { data: infos, error: infoError } = await db
    .from("payment_infos")
    .select("qr_image_path, members!inner(group_id)")
    .eq("members.group_id", groupId)
    .not("qr_image_path", "is", null);
  if (infoError) throw infoError;
  const media = await groupMediaPaths(groupId);

  const { error } = await db.rpc("delete_group", { p_group: groupId });
  if (error) throw error;

  const paths = infos.map((i) => i.qr_image_path).filter((p): p is string => p !== null);
  for (const [bucket, list] of [[QRIS_BUCKET, paths], [MEDIA_BUCKET, media]] as const) {
    if (list.length === 0) continue;
    const removed = await db.storage.from(bucket).remove([...list]);
    if (removed.error) console.error(removed.error);
  }
}

/** Ganti invite_code; tautan lama langsung tidak berlaku. */
export async function rotateInviteCode(groupId: string, actorMemberId: string): Promise<string> {
  const code = newToken();
  const { error } = await serviceClient(actorMemberId).from("groups").update({ invite_code: code }).eq("id", groupId);
  if (error) throw error;
  return code;
}

export interface PublicGroup extends GroupLook {
  memberCount: number;
}

const PUBLIC_LIMIT = 50;

/** Grup publik untuk /jelajah, terbaru dulu; `query` mencari nama. Tanpa data anggota selain jumlahnya. */
export async function listPublicGroups(query = ""): Promise<PublicGroup[]> {
  let request = serviceClient()
    .from("groups")
    .select(`${LOOK_COLUMNS}, members(count)`)
    .eq("is_public", true)
    .eq("members.is_active", true)
    .order("created_at", { ascending: false })
    .limit(PUBLIC_LIMIT);
  const term = query.trim().slice(0, 60).replace(/[%_\\,()]/g, "");
  if (term) request = request.ilike("name", `%${term}%`);
  const { data, error } = await request;
  if (error) throw error;
  return data.map((g) => ({ ...toLook(g), memberCount: g.members[0]?.count ?? 0 }));
}

/** Grup publik untuk halaman pratinjau & gabung terbuka, atau null bila tidak ada / privat. */
export async function findPublicGroup(groupId: string): Promise<PublicGroup | null> {
  if (!isUuid(groupId)) return null;
  const { data, error } = await serviceClient()
    .from("groups")
    .select(`${LOOK_COLUMNS}, members(count)`)
    .eq("id", groupId)
    .eq("is_public", true)
    .eq("members.is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data && { ...toLook(data), memberCount: data.members[0]?.count ?? 0 };
}

export async function findGroupByInvite(code: string): Promise<{ id: string; name: string; emoji: string | null } | null> {
  if (!isToken(code)) return null;
  const { data, error } = await serviceClient()
    .from("groups")
    .select("id, name, emoji")
    .eq("invite_code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}
