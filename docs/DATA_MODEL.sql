-- DATA_MODEL.sql — skema Postgres (Supabase) untuk Magerrr MVP
-- Salin ke supabase/migrations/0001_init.sql. Uang = integer rupiah. Waktu = timestamptz (UTC); batas bulan dihitung di Asia/Jakarta pada lapisan aplikasi.
-- Prinsip: klasemen & statistik TIDAK disimpan; selalu diturunkan dari matches/games (lihat docs/ALGORITHMS.md).
-- Akses: tulis lewat route handler Next.js (server) yang memeriksa peran; akses publik (tamu/penonton) lewat token acak
-- (invite_code / share_token) yang divalidasi di server dengan service role. RLS aktif sebagai lapisan kedua.

create extension if not exists pgcrypto;

create type member_role   as enum ('admin', 'member');
create type play_mode     as enum ('kocok', 'rotasi', 'fix_pasangan', 'round_robin');
create type match_kind    as enum ('doubles', 'singles');
create type match_status  as enum ('running', 'completed', 'void');
create type session_status as enum ('planned', 'running', 'finished');
create type rsvp_status   as enum ('going', 'not_going', 'maybe');
create type split_mode    as enum ('equal', 'custom', 'weighted');
create type pay_status    as enum ('unpaid', 'paid');
create type grade         as enum ('A', 'B', 'C', 'D');

-- Token acak 128 bit (hex 32 karakter)
create or replace function gen_token() returns text language sql as
$$ select encode(gen_random_bytes(16), 'hex') $$;

create table profiles (                      -- 1:1 dengan auth.users
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 60),
  emoji         text,
  owner_id      uuid not null references profiles(id),
  invite_code   text not null unique default gen_token(),
  -- aturan yang bisa diubah kapan saja (lihat ALGORITHMS.md):
  rules         jsonb not null default '{"target":21,"deuce":true,"cap":30}',      -- GameRules
  match_games   smallint not null default 1 check (match_games in (1,3,5)),
  scoring       jsonb not null default '{"winPoints":3,"lossPoints":0,"lossBonus":null,"minMatches":0}',
  default_play_mode play_mode not null default 'kocok',
  round_to      smallint not null default 500 check (round_to in (1,500,1000)),
  created_at    timestamptz not null default now()
);

create table members (                       -- pemain di sebuah grup; boleh tamu (tanpa akun)
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  user_id       uuid references profiles(id),            -- null = tamu / belum klaim
  display_name  text not null check (char_length(display_name) between 1 and 40),
  role          member_role not null default 'member',
  grade         grade,                                   -- opsional, diatur admin; dipakai kocok pasangan
  claim_token   text unique default gen_token(),          -- cookie tamu agar bisa kembali sebagai orang yang sama
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (group_id, user_id),
  unique (group_id, display_name)
);
create index on members (group_id);

create table seasons (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  name          text not null,
  starts_on     date not null,
  ends_on       date,
  closed_at     timestamptz
);

create table sessions (                      -- satu kali mabar
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  season_id     uuid references seasons(id),
  starts_at     timestamptz not null,
  venue         text,                                    -- teks bebas (nama GOR)
  court_count   smallint not null default 1 check (court_count between 1 and 12),
  duration_min  smallint check (duration_min > 0),
  play_mode     play_mode not null default 'kocok',
  rules         jsonb,                                   -- override GameRules; null = pakai grup
  match_games   smallint check (match_games in (1,3,5)),
  note          text,
  status        session_status not null default 'planned',
  share_token   text not null unique default gen_token(),-- halaman publik sesi/tagihan/recap
  recap_public  boolean not null default true,
  is_listed     boolean not null default true,           -- tampil di /jelajah bila grup publik (migrasi 0027)
  created_by    uuid references members(id),
  created_at    timestamptz not null default now()
);
create index on sessions (group_id, starts_at desc);
create index sessions_planned_idx on sessions (starts_at) where status = 'planned';

create table attendees (
  session_id    uuid not null references sessions(id) on delete cascade,
  member_id     uuid not null references members(id),
  rsvp          rsvp_status,
  present       boolean not null default false,
  minutes_played integer,                                -- untuk pembagian weighted (opsional)
  primary key (session_id, member_id)
);

create table matches (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  seq           integer not null,                        -- urutan di sesi
  kind          match_kind not null,
  court_no      smallint,
  status        match_status not null default 'running',
  winner        char(1) check (winner in ('A','B')),     -- diisi saat completed (hasil matchWinner)
  rules         jsonb,                                   -- override per match
  games_max     smallint check (games_max in (1,3,5)),
  video_url     text,                                    -- pasca-MVP (PRD 14.1)
  report_job_id text,                                    -- pasca-MVP (PRD 14.1)
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  unique (session_id, seq)
);

create table match_players (
  match_id      uuid not null references matches(id) on delete cascade,
  side          char(1) not null check (side in ('A','B')),
  member_id     uuid not null references members(id),
  primary key (match_id, member_id)
);

create table games (
  match_id      uuid not null references matches(id) on delete cascade,
  game_no       smallint not null check (game_no >= 1),
  score_a       smallint not null default 0 check (score_a between 0 and 99),
  score_b       smallint not null default 0 check (score_b between 0 and 99),
  primary key (match_id, game_no)
);

create table audit_log (
  id            bigint generated always as identity primary key,
  group_id      uuid not null references groups(id) on delete cascade,
  actor_member_id uuid references members(id),
  entity        text not null,                           -- 'match' | 'game' | 'expense' | 'payment' | 'rules'
  entity_id     text not null,
  action        text not null,                           -- 'create' | 'update' | 'delete' | 'void'
  before        jsonb,
  after         jsonb,
  at            timestamptz not null default now()
);
create index on audit_log (group_id, entity, entity_id);

create table expenses (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  name          text not null,
  amount        integer not null check (amount > 0),     -- rupiah
  paid_by       uuid not null references members(id),
  mode          split_mode not null default 'equal',
  preset        text,                                    -- 'court' | 'shuttle' | 'drink' | 'parking' | null
  meta          jsonb,                                   -- mis. {"pricePerSlop":40000,"used":4}
  created_at    timestamptz not null default now()
);

create table expense_shares (                              -- hasil shareExpense() disimpan agar riwayat stabil
  expense_id    uuid not null references expenses(id) on delete cascade,
  member_id     uuid not null references members(id),
  amount        integer not null check (amount >= 0),
  weight        integer,                                  -- untuk mode weighted
  primary key (expense_id, member_id)
);

create table settlements (                                 -- hasil settle() + status bayar manual
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  from_member   uuid not null references members(id),
  to_member     uuid not null references members(id),
  amount        integer not null check (amount > 0),
  status        pay_status not null default 'unpaid',
  self_reported boolean not null default false,            -- pemain menekan "Saya sudah bayar"; menunggu konfirmasi admin
  paid_at       timestamptz,
  unique (session_id, from_member, to_member)
);

create table payment_infos (                               -- rekening / e-wallet / QRIS milik host
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references members(id) on delete cascade,
  kind          text not null check (kind in ('bank','ewallet','qris')),
  label         text not null,                             -- "BCA", "GoPay"
  account_no    text,
  account_name  text,
  qr_image_path text,                                      -- Supabase Storage
  created_at    timestamptz not null default now()
);

-- RLS: aktifkan di semua tabel. Kebijakan minimal untuk pengguna login:
--   SELECT  : anggota grup (members.user_id = auth.uid()) boleh membaca data grupnya.
--   INSERT/UPDATE/DELETE pada matches, games, expenses, expense_shares, settlements, sessions, attendees,
--   members(grade/role), groups(rules/scoring) : hanya members.role = 'admin' di grup tsb.
-- Akses tamu & penonton publik TIDAK lewat RLS: route handler memvalidasi invite_code / share_token / claim_token
-- lalu memakai service role dengan cakupan data yang dibatasi ke satu grup / satu sesi.
alter table profiles       enable row level security;
alter table groups         enable row level security;
alter table members        enable row level security;
alter table seasons        enable row level security;
alter table sessions       enable row level security;
alter table attendees      enable row level security;
alter table matches        enable row level security;
alter table match_players  enable row level security;
alter table games          enable row level security;
alter table audit_log      enable row level security;
alter table expenses       enable row level security;
alter table expense_shares enable row level security;
alter table settlements    enable row level security;
alter table payment_infos  enable row level security;
