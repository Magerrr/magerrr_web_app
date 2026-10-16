-- 0020 — profil akun (MAGERRR-12): pengguna mengubah nama, email, dan foto profilnya sendiri.
-- Foto di bucket privat `profile-media` (folder <user>/), dibaca lewat route server: pemilik akun, atau
-- anggota grup yang sama dengan pemilik foto. Kolom lama `avatar_url` tidak dipakai (URL publik).
-- Email diubah lewat Supabase Auth (konfirmasi tautan email), bukan tabel ini.

alter table profiles add column avatar_path text;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('profile-media', 'profile-media', false, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
