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
console.log(`${files.length} migrasi diterapkan, ${tables} tabel di skema public, gen_token() ok`);
await db.close();
