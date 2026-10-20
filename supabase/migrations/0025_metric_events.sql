-- 0025 — instrumentasi metrik PRD §4 (MEO-11). Satu baris per (sesi, event, dedupe): event "sekali per sesi"
-- memakai dedupe '' ; link_opened memakai hash(sesi + id anggota atau id perangkat) agar unik per pengguna/perangkat.
-- Tanpa data pribadi baru: hanya id grup/sesi (sudah ada), nama event, waktu, dan hash satu arah. Dihapus berantai
-- bersama sesi/grup. Hanya service role yang menulis/membaca (RLS aktif tanpa kebijakan, seperti audit_log).

create table metric_events (
  id          bigint generated always as identity primary key,
  group_id    uuid not null references groups(id) on delete cascade,
  session_id  uuid not null references sessions(id) on delete cascade,
  event       text not null check (event in ('session_created','session_finished','score_recorded','bill_created','recap_shared','link_opened')),
  dedupe      text not null default '',
  created_at  timestamptz not null default now(),
  unique (session_id, event, dedupe)
);
create index on metric_events (group_id, created_at desc);

alter table metric_events enable row level security;
revoke all on metric_events from anon, authenticated;
