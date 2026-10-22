-- 0029 — Mabar Instan (#40, 2/6): RPC create_instant_session.
-- Butuh kolom dari migrasi #41: groups.is_instant, sessions.slot_count, sessions.share_token_expires_at.
--
-- Satu transaksi: grup tersembunyi (is_public=false, is_instant=true, owner=host) + host sebagai admin + sesi.
-- is_listed SELALU false (tidak dibaca dari p_session). share_token memakai default gen_token() kolomnya;
-- share_token_expires_at default = starts_at. Dipanggil lewat service role di route layer.
create or replace function public.create_instant_session(p_host uuid, p_session jsonb)
returns table (group_id uuid, session_id uuid, member_id uuid, share_token text)
language plpgsql set search_path = public as $$
declare
  v_name text;
  v_starts timestamptz := (p_session ->> 'starts_at')::timestamptz;
  v_group uuid;
  v_member uuid;
  v_session uuid;
  v_token text;
begin
  select p.display_name into v_name from profiles p where p.id = p_host;
  if not found then
    raise exception 'host_not_found' using errcode = 'P0001';
  end if;

  insert into groups (name, owner_id, is_public, is_instant)
  values (left(coalesce(nullif(p_session ->> 'venue', ''), 'Mabar Instan'), 60), p_host, false, true)
  returning id into v_group;

  insert into members (group_id, user_id, display_name, role)
  values (v_group, p_host, v_name, 'admin')
  returning id into v_member;

  insert into sessions (group_id, starts_at, venue, venue_url, venue_lat, venue_lng, court_count, duration_min,
                        play_mode, rules, match_games, note, created_by,
                        slot_count, share_token_expires_at, is_listed)
  values (
    v_group,
    v_starts,
    p_session ->> 'venue',
    p_session ->> 'venue_url',
    (p_session ->> 'venue_lat')::double precision,
    (p_session ->> 'venue_lng')::double precision,
    coalesce((p_session ->> 'court_count')::smallint, 1),
    (p_session ->> 'duration_min')::smallint,
    coalesce((p_session ->> 'play_mode')::play_mode, 'kocok'),
    nullif(p_session -> 'rules', 'null'::jsonb),
    (p_session ->> 'match_games')::smallint,
    p_session ->> 'note',
    v_member,
    (p_session ->> 'slot_count')::smallint,
    coalesce((p_session ->> 'share_token_expires_at')::timestamptz, v_starts),
    false
  )
  returning id, sessions.share_token into v_session, v_token;

  -- Host otomatis hadir di sesinya sendiri (mengisi 1 slot).
  insert into attendees (session_id, member_id, present) values (v_session, v_member, true);

  return query select v_group, v_session, v_member, v_token;
end $$;

revoke execute on function public.create_instant_session(uuid, jsonb) from public, anon, authenticated;
