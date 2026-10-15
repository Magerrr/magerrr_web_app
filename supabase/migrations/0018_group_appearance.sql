-- 0018 — tampilan grup (MAGERRR-8): warna tema (preset palet Meadow agar teks ink-black tetap kontras),
-- logo, dan gambar sampul yang tampil di beranda grup. Gambar di Storage privat `group-media`, dibaca lewat
-- route server (anggota, atau semua orang bila grup publik). Bucket yang sama dipakai foto momen grup.

alter table groups
  add column theme text not null default 'grass' check (theme in ('grass', 'sky', 'coral', 'sunshine', 'sand')),
  add column logo_path text,
  add column cover_path text;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('group-media', 'group-media', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
