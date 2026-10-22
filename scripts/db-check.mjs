// Validasi migrasi tanpa Docker: terapkan supabase/migrations/*.sql berurutan ke PGlite
// (Postgres WASM) di atas stub minimal objek Supabase yang dirujuk migrasi.
// Validasi penuh tetap `npx supabase db reset` (butuh Docker).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS = "supabase/migrations";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema extensions;
  create extension if not exists pgcrypto schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`;

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUB);

const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  try {
    await db.exec(await readFile(join(MIGRATIONS, file), "utf8"));
    console.log(`ok   ${file}`);
  } catch (error) {
    console.error(`GAGAL ${file}: ${error.message}`);
    process.exit(1);
  }
}

const { rows } = await db.query(`
  select (select count(*)::int from pg_tables where schemaname = 'public') as tables,
         gen_token() as token
`);
const { tables, token } = rows[0];
if (!/^[0-9a-f]{32}$/.test(token)) {
  console.error(`GAGAL gen_token() menghasilkan "${token}", bukan hex 128 bit`);
  process.exit(1);
}

// create_instant_session: grup tersembunyi + host admin + sesi; is_listed tidak bisa dipaksa true lewat payload.
const HOST = "00000000-0000-0000-0000-0000000000a1";
await db.exec(`insert into auth.users (id, email) values ('${HOST}', 'host@example.test')`);
await db.exec(`update profiles set display_name = 'Host' where id = '${HOST}'`);
await db.query(`select * from create_instant_session($1, $2::jsonb)`, [
  HOST,
  JSON.stringify({ starts_at: "2030-01-01T10:00:00Z", venue: "GOR A", slot_count: 8, is_listed: true }),
]);
const { rows: inst } = await db.query(`
  select s.is_listed, s.slot_count, s.share_token_expires_at = s.starts_at as expiry_ok, s.share_token ~ '^[0-9a-f]{32}$' as token_ok,
         g.is_public, g.is_instant, g.owner_id = $1 as owner_ok, m.role,
         (select count(*)::int from attendees a where a.session_id = s.id) as attendees
  from sessions s join groups g on g.id = s.group_id join members m on m.group_id = g.id and m.user_id = $1`, [HOST]);
const i = inst[0];
if (!i || i.is_listed || i.is_public || !i.is_instant || !i.owner_ok || i.role !== "admin" || i.slot_count !== 8
    || !i.expiry_ok || !i.token_ok || i.attendees !== 1) {
  console.error(`GAGAL create_instant_session: ${JSON.stringify(inst)}`);
  process.exit(1);
}
console.log("create_instant_session ok");

// join_instant_session + rotate_instant_token: happy path, expired, full, rotate oleh bukan host.
const fail = (msg) => {
  console.error(`GAGAL ${msg}`);
  process.exit(1);
};
const expectError = async (label, sql, params, message) => {
  try {
    await db.query(sql, params);
  } catch (error) {
    if (error.message === message) return;
    fail(`${label}: error "${error.message}", diharapkan "${message}"`);
  }
  fail(`${label}: tidak error, diharapkan "${message}"`);
};
const newSession = async (slots, expires) => {
  const { rows } = await db.query(`select * from create_instant_session($1, $2::jsonb)`, [
    HOST,
    JSON.stringify({ starts_at: "2030-01-01T10:00:00Z", slot_count: slots, share_token_expires_at: expires }),
  ]);
  return rows[0];
};
const JOIN = `select * from join_instant_session($1, $2, $3)`;

const open = await newSession(2, "2030-01-01T10:00:00Z");
const { rows: j1 } = await db.query(JOIN, [open.share_token, "Tamu Satu", null]);
if (j1[0].session_id !== open.session_id || j1[0].group_id !== open.group_id || !j1[0].claim_token) {
  fail(`join_instant_session happy path: ${JSON.stringify(j1)}`);
}
const { rows: going } = await db.query(
  `select count(*)::int as n from attendees where session_id = $1 and rsvp = 'going' and member_id = $2`,
  [open.session_id, j1[0].member_id],
);
if (going[0].n !== 1) fail("join_instant_session tidak membuat RSVP going");
// sesi penuh (host + Tamu Satu = 2 slot): orang baru ditolak.
await expectError("join penuh", JOIN, [open.share_token, "Tamu Dua", null], "session_full");

// pengguna akun idempoten: gabung ulang tidak menggandakan anggota/slot, juga saat sesi sudah penuh.
const USER = "00000000-0000-0000-0000-0000000000b2";
await db.exec(`insert into auth.users (id, email) values ('${USER}', 'user@example.test')`);
await db.exec(`update profiles set display_name = 'Akun' where id = '${USER}'`);
const roomy = await newSession(3, "2030-01-01T10:00:00Z");
const { rows: u1 } = await db.query(JOIN, [roomy.share_token, "Akun", USER]);
await db.query(`select * from join_instant_session($1, $2, $3)`, [roomy.share_token, "Tamu Tiga", null]); // penuh (3/3)
const { rows: u2 } = await db.query(JOIN, [roomy.share_token, "Akun", USER]);
if (u1[0].member_id !== u2[0].member_id || u1[0].claim_token !== null) fail("join ulang akun tidak idempoten");
await expectError("join token tidak dikenal", JOIN, ["bukan-token", "X", null], "session_expired");

const stale = await newSession(8, "2020-01-01T00:00:00Z");
await expectError("join kedaluwarsa", JOIN, [stale.share_token, "Telat", null], "session_expired");

// rotate: host dan admin boleh; anggota biasa/orang luar ditolak; token lama mati, token baru hidup + kedaluwarsa diperbarui.
await expectError("rotate bukan host", `select * from rotate_instant_token($1, $2)`, [stale.session_id, j1[0].member_id], "not_authorized");
await expectError("rotate tanpa pelaku", `select * from rotate_instant_token($1, $2)`, [stale.session_id, null], "not_authorized");
const { rows: rot } = await db.query(`select * from rotate_instant_token($1, $2)`, [stale.session_id, stale.member_id]);
if (!/^[0-9a-f]{32}$/.test(rot[0].share_token) || rot[0].share_token === stale.share_token
    || new Date(rot[0].share_token_expires_at) <= new Date()) {
  fail(`rotate_instant_token happy path: ${JSON.stringify(rot)}`);
}
await expectError("token lama setelah rotate", JOIN, [stale.share_token, "Telat", null], "session_expired");
const { rows: back } = await db.query(JOIN, [rot[0].share_token, "Telat", null]);
if (back[0].session_id !== stale.session_id) fail("join dengan token baru gagal");
const { rows: audit } = await db.query(
  `select count(*)::int as n from audit_log where entity = 'session_share_token' and entity_id = $1 and actor_member_id = $2`,
  [stale.session_id, stale.member_id],
);
if (audit[0].n !== 1) fail("rotate_instant_token tidak menulis audit_log");

// execute dicabut dari public/anon/authenticated.
for (const sig of ["join_instant_session(text, text, uuid)", "rotate_instant_token(uuid, uuid)"]) {
  const { rows: priv } = await db.query(
    `select has_function_privilege('anon', '${sig}', 'execute') or has_function_privilege('authenticated', '${sig}', 'execute') as open`,
  );
  if (priv[0].open) fail(`${sig} masih bisa dieksekusi anon/authenticated`);
}
console.log("join_instant_session + rotate_instant_token ok");
console.log(`${files.length} migrasi diterapkan, ${tables} tabel di skema public, gen_token() ok`);
await db.close();
