-- 0011 — obrolan grup. Hanya anggota grup (akun atau tamu ber-cookie) yang membaca & menulis, lewat
-- route handler server. Pesan yang dihapus dikosongkan (soft delete) agar urutan & cursor tetap.

create table chat_messages (
  id            bigint generated always as identity primary key,              -- juga cursor polling
  group_id      uuid not null references groups(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references members(id) on delete set null,
  constraint chat_messages_body check (
    (deleted_at is null and char_length(body) between 1 and 1000) or (deleted_at is not null and body = '')
  )
);
create index on chat_messages (group_id, id desc);
create index on chat_messages (group_id, deleted_at) where deleted_at is not null;
create index on chat_messages (member_id, created_at desc);

-- Pesan terakhir yang sudah dibaca anggota (untuk penanda "pesan baru").
alter table members add column chat_read_id bigint;

alter table chat_messages enable row level security;
