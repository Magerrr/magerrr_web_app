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
console.log(`${files.length} migrasi diterapkan, ${tables} tabel di skema public, gen_token() ok`);
await db.close();
