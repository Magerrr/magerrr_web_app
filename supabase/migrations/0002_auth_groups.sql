-- 0002 — auth & grup (BUILD_PLAN Fase 2)
--
-- Model akses (docs/DECISIONS.md): semua baca/tulis data lewat server Next.js dengan service role
-- setelah authz di src/lib/db/authz.ts. RLS tetap aktif TANPA policy untuk anon/authenticated
-- (deny-all), jadi publishable key yang publik tidak bisa membaca atau menulis tabel langsung
-- dan tidak bisa melewati audit_log.

-- gen_token(): pgcrypto di Supabase ada di schema `extensions`; kunci search_path.
alter function public.gen_token() set search_path = public, extensions;

-- Profil dibuat otomatis saat user mendaftar (Google / magic link).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Pemain'
    ), 40)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buat grup + pembuatnya sebagai admin dalam satu transaksi.
create or replace function public.create_group(
  p_owner uuid, p_name text, p_emoji text, p_display_name text
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_group uuid;
begin
  insert into groups (name, emoji, owner_id)
  values (p_name, p_emoji, p_owner)
  returning id into v_group;

  insert into members (group_id, user_id, display_name, role)
  values (v_group, p_owner, p_display_name, 'admin');

  return v_group;
end $$;

-- Audit perubahan aturan grup (entity 'rules'). Pelaku dibaca dari header permintaan
-- `x-actor-member-id` yang dipasang server; null bila perubahan dari luar aplikasi.
create or replace function public.request_actor() returns uuid
language sql stable set search_path = public as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-actor-member-id', '')::uuid
$$;

create or replace function public.audit_group_rules() returns trigger
language plpgsql set search_path = public as $$
declare
  v_before jsonb := jsonb_build_object(
    'rules', old.rules, 'match_games', old.match_games, 'scoring', old.scoring,
    'round_to', old.round_to, 'default_play_mode', old.default_play_mode);
  v_after jsonb := jsonb_build_object(
    'rules', new.rules, 'match_games', new.match_games, 'scoring', new.scoring,
    'round_to', new.round_to, 'default_play_mode', new.default_play_mode);
begin
  if v_before is distinct from v_after then
    insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
    values (new.id, request_actor(), 'rules', new.id::text, 'update', v_before, v_after);
  end if;
  return new;
end $$;

create trigger audit_group_rules
  after update on groups
  for each row execute function public.audit_group_rules();

-- Fungsi hanya boleh dipanggil server (service role), bukan lewat publishable key.
revoke execute on function public.gen_token() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_group(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.request_actor() from public, anon, authenticated;
revoke execute on function public.audit_group_rules() from public, anon, authenticated;
