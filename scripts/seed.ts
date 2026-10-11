// `npm run seed` — data demo di Supabase LOKAL: 1 grup, 12 anggota, 3 sesi, 25 match, patungan.
// Aman diulang: grup demo lama milik akun demo dihapus dulu. Menolak berjalan ke Supabase non-lokal.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { MatchRecord } from "../src/lib/core/types";
import type { Database, Json } from "../src/lib/db/database.types";
import { fromJakartaParts, toJakartaParts } from "../src/lib/time";
import { GROUP, MEMBERS, RULES, SESSIONS, planBill, planSessionMatches } from "./seed-plan";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const email = process.env.SEED_EMAIL ?? "demo@magerrr.test";

function fail(message: string): never {
  console.error(`Seed gagal: ${message}`);
  process.exit(1);
}

if (!url || !secret) fail("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY belum diisi (lihat .env.example).");
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  fail(`seed hanya untuk Supabase lokal, bukan ${new URL(url).hostname}.`);
}

const db = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
function check<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error) fail(`${what}: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

async function demoUser(): Promise<string> {
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  for (let page = 1; ; page++) {
    const listed = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) fail(`daftar user: ${listed.error.message}`);
    const { users } = listed.data;
    const found = users.find((u) => u.email === email);
    if (found) return found.id;
    if (users.length < 200) fail(`tidak bisa membuat atau menemukan ${email}: ${created.error?.message}`);
  }
}

/** Tanggal WIB `daysAgo` hari sebelum hari ini, jam 19.00. */
function sessionStart(daysAgo: number): Date {
  const today = fromJakartaParts(toJakartaParts(new Date()).date, "19:00")!;
  return new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

async function main() {
  const userId = await demoUser();
  check(await db.from("profiles").update({ display_name: MEMBERS[0].name }).eq("id", userId), "profil");
  // Grup demo lama: hapus sesi & audit dulu (attendees/audit_log merujuk anggota tanpa cascade).
  const old = check(await db.from("groups").select("id").eq("owner_id", userId).eq("name", GROUP.name), "grup demo lama").map((g) => g.id);
  if (old.length > 0) {
    check(await db.from("sessions").delete().in("group_id", old), "hapus sesi demo lama");
    check(await db.from("audit_log").delete().in("group_id", old), "hapus audit demo lama");
    check(await db.from("groups").delete().in("id", old), "hapus grup demo lama");
  }

  const groupId = check(
    await db.rpc("create_group", { p_owner: userId, p_name: GROUP.name, p_emoji: GROUP.emoji, p_display_name: MEMBERS[0].name }),
    "buat grup",
  );
  const host = check(await db.from("members").select("id").eq("group_id", groupId).eq("user_id", userId).single(), "host");
  check(await db.from("members").update({ grade: MEMBERS[0].grade }).eq("id", host.id), "grade host");
  const guests = check(
    await db
      .from("members")
      .insert(MEMBERS.slice(1).map((m) => ({ group_id: groupId, display_name: m.name, grade: m.grade })))
      .select("id, display_name"),
    "anggota",
  );
  const ids = [host.id, ...MEMBERS.slice(1).map((m) => guests.find((g) => g.display_name === m.name)!.id)];
  const grades = new Map(MEMBERS.map((m, i) => [ids[i], m.grade]));
  const actor = createClient<Database>(url!, secret!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-actor-member-id": host.id } },
  });

  check(
    await db.from("payment_infos").insert({ member_id: host.id, kind: "bank", label: "BCA", account_no: "1234567890", account_name: "Raka (demo)" }),
    "info pembayaran",
  );

  const history: MatchRecord[] = [];
  let matchCount = 0;
  for (const [index, s] of SESSIONS.entries()) {
    const present = s.present.map((i) => ids[i]);
    const sessionId = check(
      await actor.rpc("create_session", {
        p_group: groupId,
        p_creator: host.id,
        p_session: {
          starts_at: sessionStart(s.daysAgo).toISOString(),
          venue: s.venue,
          court_count: s.courts,
          duration_min: 120,
          play_mode: "kocok",
          rules: null,
          match_games: null,
          note: index === 0 ? "Data demo dari npm run seed." : null,
        },
        p_attendees: present,
        p_expenses: [],
      }),
      `sesi ${index + 1}`,
    );
    check(await db.from("sessions").update({ status: "running" }).eq("id", sessionId), "mulai sesi");

    const matches = planSessionMatches(sessionId, present, grades, s.matches, s.courts, history, 1000 + index);
    for (const m of matches) {
      check(
        await actor.rpc("record_result", {
          p_session: sessionId,
          p_match: null as unknown as string,
          p_result: { kind: m.kind, court_no: null, players: m.players, games: m.games, winner: m.winner, rules: RULES, games_max: 1 } as unknown as Json,
          p_next: null as unknown as Json,
          p_queue: null as unknown as string[],
        }),
        `match ${m.order} sesi ${index + 1}`,
      );
    }
    history.push(...matches);
    matchCount += matches.length;

    // Biaya + bagian + transfer (pembagian dari fungsi inti, sama seperti halaman Patungan).
    const expenseIds = s.expenses.map(() => randomUUID());
    check(
      await actor.from("expenses").insert(
        s.expenses.map((e, i) => ({ id: expenseIds[i], session_id: sessionId, name: e.name, amount: e.amount, paid_by: ids[e.paidBy], mode: "equal" as const, preset: e.preset, split_all: true })),
      ),
      "biaya",
    );
    const bill = planBill(present, s.expenses.map((e) => ({ amount: e.amount, paidBy: ids[e.paidBy] })), host.id);
    const paidAt = new Date(sessionStart(s.daysAgo).getTime() + 3 * 60 * 60 * 1000).toISOString();
    check(
      await actor.rpc("save_bill", {
        p_session: sessionId,
        p_op: "recompute",
        p_expense: null as unknown as Json,
        p_shares: bill.shares.map((x) => ({ expense_id: expenseIds[x.expense], member_id: x.memberId, amount: x.amount, weight: null })),
        p_settlements: bill.transfers.map((t, i) => {
          const paid = s.paid === "all" || s.paid.includes(i);
          return { from: t.from, to: t.to, amount: t.amount, status: paid ? "paid" : "unpaid", self_reported: !paid && s.selfReported.includes(i), paid_at: paid ? paidAt : null };
        }),
        p_present: null as unknown as string[],
        p_version: 0,
      }),
      "tagihan",
    );
    if (s.status === "finished") check(await db.from("sessions").update({ status: "finished" }).eq("id", sessionId), "tutup sesi");
  }

  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) fail(`tautan masuk: ${link.error.message}`);
  console.log(`Seed selesai: grup "${GROUP.name}", ${ids.length} anggota, ${SESSIONS.length} sesi, ${matchCount} match.`);
  console.log(`Akun demo (admin): ${email} — masuk lewat email di Mailpit (http://127.0.0.1:54324), atau buka:`);
  console.log(`${site}/auth/callback?token_hash=${link.data.properties.hashed_token}&type=magiclink&next=/g/${groupId}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
