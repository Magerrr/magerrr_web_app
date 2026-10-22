-- 0030 — Mabar Instan (#40, 3/6): RPC join_instant_session + rotate_instant_token.
-- Butuh kolom dari migrasi 0028: sessions.slot_count, sessions.share_token_expires_at.
-- Keduanya dipanggil lewat service role di route layer (execute dicabut dari public/anon/authenticated).

-- Gabung via tautan share_token + RSVP "going" dalam satu transaksi. Mirip join_public_session, tetapi validasinya:
--   token tidak dikenal / sudah kedaluwarsa (share_token_expires_at < now()) / sesi selesai → P0001 session_expired
--   attendee sudah mencapai slot_count (slot_count null = tanpa batas)                      → P0001 session_full
-- Attendee = baris attendees dengan rsvp = 'going' atau present (host terdaftar present, rsvp null).
-- Baris sesi dikunci agar dua orang yang berebut slot terakhir tidak sama-sama lolos. Idempoten: anggota yang sudah
-- tergabung tidak dihitung ganda, jadi boleh memanggil ulang walau sesi penuh. claim_token hanya untuk tamu baru.
create or replace function public.join_instant_session(p_token text, p_display_name text, p_user uuid)
returns table (group_id uuid, session_id uuid, member_id uuid, claim_token text)
language plpgsql set search_path = public as $$
declare
  s sessions%rowtype;
  v_member uuid;
  v_claim text;
  v_taken integer;
  v_already boolean := false;
begin
  select * into s from sessions where share_token = p_token for update;
  if not found
     or s.status = 'finished'
     or (s.share_token_expires_at is not null and s.share_token_expires_at < now()) then
    raise exception 'session_expired' using errcode = 'P0001';
  end if;

  if p_user is not null then
    select m.id into v_member from members m where m.group_id = s.group_id and m.user_id = p_user;
  end if;
  if v_member is not null and not exists (select 1 from members m where m.id = v_member and m.is_active) then
    raise exception 'session_expired' using errcode = 'P0001';
  end if;

  if s.slot_count is not null then
    select count(*)::int into v_taken from attendees a where a.session_id = s.id and (a.rsvp = 'going' or a.present);
    if v_member is not null then
      select exists (
        select 1 from attendees a where a.session_id = s.id and a.member_id = v_member and (a.rsvp = 'going' or a.present)
      ) into v_already;
    end if;
    if not v_already and v_taken >= s.slot_count then
      raise exception 'session_full' using errcode = 'P0001';
    end if;
  end if;

  if v_member is null then
    insert into members (group_id, user_id, display_name)
    values (s.group_id, p_user, p_display_name)
    returning id, members.claim_token into v_member, v_claim;
    if p_user is not null then v_claim := null; end if;
  end if;

  insert into attendees (session_id, member_id, rsvp)
  values (s.id, v_member, 'going')
  on conflict on constraint attendees_pkey do update set rsvp = 'going';

  return query select s.group_id, s.id, v_member, v_claim;
end $$;
revoke execute on function public.join_instant_session(text, text, uuid) from public, anon, authenticated;

-- Ganti share_token: hanya host (sessions.created_by) atau admin aktif di grup sesi. p_actor = members.id.
-- Token lama langsung tak berlaku (kolomnya diganti). Expiry baru = yang lebih lambat antara starts_at dan 24 jam dari
-- sekarang, supaya tautan baru tetap berguna walau sesi sudah dimulai. Selain pelaku tidak berwenang → P0001 not_authorized.
-- Menulis audit_log (tanpa nilai token — itu rahasia; hanya expiry lama/baru).
create or replace function public.rotate_instant_token(p_session uuid, p_actor uuid)
returns table (share_token text, share_token_expires_at timestamptz)
language plpgsql set search_path = public as $$
declare
  s sessions%rowtype;
  v_token text := gen_token();
  v_expires timestamptz;
begin
  select * into s from sessions where id = p_session for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;
  if p_actor is null or not (
       s.created_by = p_actor
       or exists (select 1 from members m
                  where m.id = p_actor and m.group_id = s.group_id and m.role = 'admin' and m.is_active)
     ) then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;

  v_expires := greatest(s.starts_at, now() + interval '24 hours');
  update sessions set share_token = v_token, share_token_expires_at = v_expires where id = s.id;

  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (s.group_id, p_actor, 'session_share_token', s.id::text, 'update',
    jsonb_build_object('share_token_expires_at', s.share_token_expires_at),
    jsonb_build_object('share_token_expires_at', v_expires));

  return query select v_token, v_expires;
end $$;
revoke execute on function public.rotate_instant_token(uuid, uuid) from public, anon, authenticated;
