-- 0019 — momen grup (MAGERRR-9): foto main bareng yang diunggah anggota (akun atau tamu), tampil di beranda
-- dan galeri grup; untuk grup publik, momen terbaru jadi gambar kecil di daftar Jelajahi bila belum ada sampul.
-- Berkas di bucket privat `group-media` (folder <group>/moments/), dibaca lewat route server.
-- Hapus: pengunggah atau admin (dicek di server). RLS deny-all seperti tabel lain.

create table group_moments (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  session_id  uuid references sessions(id) on delete set null,
  image_path  text not null,
  caption     text check (char_length(caption) <= 200),
  created_at  timestamptz not null default now()
);
create index on group_moments (group_id, created_at desc);
create index on group_moments (member_id);
create index on group_moments (session_id);

alter table group_moments enable row level security;
