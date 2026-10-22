-- 0028 — Mabar Instan (#40, bagian 1/6): skema saja. RPC/route/UI ada di issue terpisah.
-- groups.is_instant: grup dibuat otomatis oleh alur Mabar Instan (bukan grup permanen).
-- sessions.slot_count: jumlah slot pemain (null = tanpa batas, perilaku lama).
-- sessions.share_token_expires_at: kedaluwarsa tautan publik (null = tidak kedaluwarsa).

alter table groups add column is_instant boolean not null default false;

alter table sessions add column slot_count smallint check (slot_count between 2 and 40);
alter table sessions add column share_token_expires_at timestamptz;
