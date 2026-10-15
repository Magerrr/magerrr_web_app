-- 0017 — grup publik / privat (MAGERRR-6). Privat (bawaan): hanya bisa gabung lewat tautan undangan.
-- Publik: tampil di /jelajah untuk semua pengunjung dan siapa pun bisa gabung tanpa tautan.
-- Daftar publik hanya menampilkan nama, ikon, dan jumlah anggota (tanpa nama anggota / skor);
-- dibaca server dengan service role seperti tabel lain (RLS deny-all).

alter table groups add column is_public boolean not null default false;
create index groups_public_idx on groups (created_at desc) where is_public;
