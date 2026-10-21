-- 0027 — sesi publik (#15, P1): sesi Rencana milik grup publik tampil di /jelajah kecuali host menyembunyikannya.
-- is_listed hanya berlaku bila grupnya is_public; grup privat tidak pernah ikut daftar apa pun nilainya.

alter table sessions add column is_listed boolean not null default true;
create index sessions_planned_idx on sessions (starts_at) where status = 'planned';

-- Mengubah tampil/sembunyi menulis audit_log, pelaku dari header x-actor-member-id.
create or replace function public.audit_session_listed() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.is_listed is distinct from new.is_listed then
    insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
    values (new.group_id, request_actor(), 'session_listed', new.id::text, 'update',
      jsonb_build_object('is_listed', old.is_listed), jsonb_build_object('is_listed', new.is_listed));
  end if;
  return new;
end $$;

create trigger audit_session_listed
  after update of is_listed on sessions
  for each row execute function public.audit_session_listed();

revoke execute on function public.audit_session_listed() from public, anon, authenticated;

-- Gabung ke grup publik + RSVP "going" dalam satu transaksi. Idempoten: pengguna akun yang sudah jadi anggota dipakai
-- ulang (tidak ada anggota ganda), RSVP hanya di-upsert. Tamu (p_user null) selalu anggota baru; nama kembar → 23505.
-- Ditolak (P0001 session_not_open) bila sesi bukan Rencana, sudah lewat, tersembunyi, atau grupnya tidak publik.
-- claim_token hanya dikembalikan untuk tamu baru.
create or replace function public.join_public_session(p_session uuid, p_display_name text, p_user uuid)
returns table (group_id uuid, member_id uuid, claim_token text)
language plpgsql set search_path = public as $$
declare
  s sessions%rowtype;
  v_member uuid;
  v_claim text;
begin
  select * into s from sessions where id = p_session;
  if not found
     or s.status <> 'planned' or s.starts_at < now() or not s.is_listed
     or not exists (select 1 from groups g where g.id = s.group_id and g.is_public) then
    raise exception 'session_not_open' using errcode = 'P0001';
  end if;

  if p_user is not null then
    select m.id into v_member from members m where m.group_id = s.group_id and m.user_id = p_user;
  end if;
  if v_member is null then
    insert into members (group_id, user_id, display_name)
    values (s.group_id, p_user, p_display_name)
    returning id, members.claim_token into v_member, v_claim;
    if p_user is not null then v_claim := null; end if;
  elsif not exists (select 1 from members m where m.id = v_member and m.is_active) then
    raise exception 'session_not_open' using errcode = 'P0001';
  end if;

  insert into attendees (session_id, member_id, rsvp)
  values (p_session, v_member, 'going')
  on conflict (session_id, member_id) do update set rsvp = 'going';

  return query select s.group_id, v_member, v_claim;
end $$;
revoke execute on function public.join_public_session(uuid, text, uuid) from public, anon, authenticated;
