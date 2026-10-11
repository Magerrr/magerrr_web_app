import "server-only";
import { randomBytes } from "node:crypto";
import type { GameRules } from "@/lib/core/rules";
import type { ScoringConfig } from "@/lib/core/standings";
import { isToken, type GroupSettingsPatch } from "@/lib/validation";
import { guestCookies, type AuthUser } from "./authz";
import type { Database } from "./database.types";
import { serviceClient } from "./supabase";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type PlayMode = Database["public"]["Enums"]["play_mode"];

export interface GroupSettings {
  id: string;
  name: string;
  emoji: string | null;
  ownerId: string;
  rules: GameRules;
  matchGames: 1 | 3 | 5;
  scoring: ScoringConfig;
  roundTo: 1 | 500 | 1000;
  defaultPlayMode: PlayMode;
}

const GROUP_COLUMNS = "id, name, emoji, owner_id, rules, match_games, scoring, round_to, default_play_mode" as const;

function toSettings(row: Omit<GroupRow, "invite_code" | "created_at">): GroupSettings {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    ownerId: row.owner_id,
    rules: row.rules as unknown as GameRules,
    matchGames: row.match_games as GroupSettings["matchGames"],
    scoring: row.scoring as unknown as ScoringConfig,
    roundTo: row.round_to as GroupSettings["roundTo"],
    defaultPlayMode: row.default_play_mode,
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

export interface GroupSummary {
  id: string;
  name: string;
  emoji: string | null;
  role: "admin" | "member";
  via: "account" | "guest";
  memberName: string;
}

/** Grup milik pengunjung: lewat akun login dan lewat cookie tamu. */
export async function listMyGroups(user: AuthUser | null): Promise<GroupSummary[]> {
  const db = serviceClient();
  const select = "role, display_name, groups!inner(id, name, emoji)" as const;
  const result: GroupSummary[] = [];

  if (user) {
    const { data, error } = await db.from("members").select(select).eq("user_id", user.id).eq("is_active", true);
    if (error) throw error;
    for (const m of data) {
      result.push({ ...m.groups, role: m.role, via: "account", memberName: m.display_name });
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
        result.push({ ...m.groups, role: m.role, via: "guest", memberName: m.display_name });
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

  // Trigger audit_group_rules mencatat perubahan aturan beserta pelakunya.
  const { error } = await serviceClient(actorMemberId).from("groups").update(update).eq("id", groupId);
  if (error) throw error;
}

/** Ganti invite_code; tautan lama langsung tidak berlaku. */
export async function rotateInviteCode(groupId: string, actorMemberId: string): Promise<string> {
  const code = newToken();
  const { error } = await serviceClient(actorMemberId).from("groups").update({ invite_code: code }).eq("id", groupId);
  if (error) throw error;
  return code;
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
