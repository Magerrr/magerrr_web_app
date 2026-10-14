-- 0013 — pencatat skor per lapangan (ALGORITHMS §1d). Paling banyak satu anggota per lapangan per sesi;
-- tanpa baris = admin grup yang mencatat. Ditulis lewat route handler server (RLS deny-all seperti tabel lain).

create table court_scorers (
  session_id  uuid not null references sessions(id) on delete cascade,
  court_no    smallint not null check (court_no between 1 and 12),
  member_id   uuid not null references members(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (session_id, court_no)
);
create index on court_scorers (member_id);

alter table court_scorers enable row level security;
