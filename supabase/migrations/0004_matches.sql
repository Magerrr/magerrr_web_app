-- 0004 — match & skor (BUILD_PLAN Fase 4)
--
-- Validasi skor dilakukan di aplikasi dengan fungsi inti (src/lib/core/rules.ts); fungsi di sini
-- menulis secara atomik dan mencatat audit. Poin live (match `running`) tidak diaudit; hasil match
-- (create), edit hasil (update), dan pembatalan (void) diaudit dengan snapshot sebelum/sesudah.

alter table sessions
  add column kocok_seed bigint,           -- seed kocok ronde terakhir yang dimulai (reproduksi planRound)
  add column rotation_queue uuid[];       -- antrian mode rotasi (null = rotasi belum dimulai)

create index on matches (session_id, status);
-- Satu match berjalan per lapangan.
create unique index matches_one_running_per_court on matches (session_id, court_no)
  where status = 'running' and court_no is not null;

create or replace function public.match_snapshot(p_match uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'kind', m.kind,
    'court_no', m.court_no,
    'status', m.status,
    'winner', m.winner,
    'players', jsonb_build_object(
      'A', coalesce((select jsonb_agg(mp.member_id order by mp.member_id) from match_players mp where mp.match_id = m.id and mp.side = 'A'), '[]'::jsonb),
      'B', coalesce((select jsonb_agg(mp.member_id order by mp.member_id) from match_players mp where mp.match_id = m.id and mp.side = 'B'), '[]'::jsonb)
    ),
    'games', coalesce((select jsonb_agg(jsonb_build_array(g.score_a, g.score_b) order by g.game_no) from games g where g.match_id = m.id), '[]'::jsonb)
  )
  from matches m where m.id = p_match
$$;

-- p_players: {"A": [uuid…], "B": [uuid…]}
create or replace function public.write_match_players(p_match uuid, p_players jsonb) returns void
language plpgsql set search_path = public as $$
begin
  delete from match_players where match_id = p_match;
  insert into match_players (match_id, side, member_id)
  select p_match, s.side, (x.value #>> '{}')::uuid
  from (values ('A'), ('B')) s(side)
  cross join lateral jsonb_array_elements(p_players -> s.side) x;
end $$;

-- p_games: [{"a": 21, "b": 19}, …] → game_no 1..n
create or replace function public.write_games(p_match uuid, p_games jsonb) returns void
language plpgsql set search_path = public as $$
begin
  delete from games where match_id = p_match;
  insert into games (match_id, game_no, score_a, score_b)
  select p_match, g.ord::smallint, (g.value ->> 'a')::smallint, (g.value ->> 'b')::smallint
  from jsonb_array_elements(p_games) with ordinality g(value, ord);
end $$;

-- p_match: {kind, court_no, players, games, winner, rules, games_max}
create or replace function public.insert_match(p_session uuid, p_match jsonb, p_status match_status) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_seq integer;
begin
  perform 1 from sessions where id = p_session for update; -- serialisasi nomor urut per sesi
  select coalesce(max(seq), 0) + 1 into v_seq from matches where session_id = p_session;
  insert into matches (session_id, seq, kind, court_no, status, winner, rules, games_max, completed_at)
  values (
    p_session, v_seq,
    (p_match ->> 'kind')::match_kind,
    (p_match ->> 'court_no')::smallint,
    p_status,
    p_match ->> 'winner',
    nullif(p_match -> 'rules', 'null'::jsonb),
    (p_match ->> 'games_max')::smallint,
    case when p_status = 'completed' then now() end
  )
  returning id into v_id;
  perform write_match_players(v_id, p_match -> 'players');
  perform write_games(v_id, coalesce(p_match -> 'games', '[{"a": 0, "b": 0}]'::jsonb));
  return v_id;
end $$;

-- Mulai satu ronde: match `running` di lapangan kosong; simpan seed kocok / antrian rotasi.
create or replace function public.start_matches(
  p_session uuid, p_matches jsonb, p_seed bigint, p_queue uuid[]
) returns uuid[]
language plpgsql set search_path = public as $$
declare
  v_match jsonb;
  v_ids uuid[] := '{}';
begin
  for v_match in select value from jsonb_array_elements(p_matches) loop
    v_ids := v_ids || insert_match(p_session, v_match, 'running');
  end loop;
  update sessions
  set kocok_seed = coalesce(p_seed, kocok_seed),
      rotation_queue = coalesce(p_queue, rotation_queue)
  where id = p_session;
  return v_ids;
end $$;

-- Skor live (tanpa audit). Hanya untuk match yang masih berjalan.
create or replace function public.set_live_score(p_match uuid, p_games jsonb) returns void
language plpgsql set search_path = public as $$
begin
  perform 1 from matches where id = p_match and status = 'running' for update;
  if not found then
    raise exception 'match_not_running' using errcode = 'P0001';
  end if;
  perform write_games(p_match, p_games);
end $$;

-- Catat hasil: match baru (input manual), menyelesaikan match berjalan, atau mengedit hasil.
-- Opsional: match berikutnya di lapangan yang sama (rotasi) dan antrian baru.
create or replace function public.record_result(
  p_session uuid, p_match uuid, p_result jsonb, p_next jsonb, p_queue uuid[]
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid := p_match;
  v_prev match_status;
  v_before jsonb;
  v_action text;
begin
  if v_id is null then
    v_id := insert_match(p_session, p_result, 'completed');
    v_action := 'create';
  else
    select status into v_prev from matches where id = v_id and session_id = p_session for update;
    if not found then
      raise exception 'match_not_found' using errcode = 'P0001';
    end if;
    if v_prev = 'void' then
      raise exception 'match_void' using errcode = 'P0001';
    end if;
    v_before := case when v_prev = 'completed' then match_snapshot(v_id) end;
    v_action := case when v_prev = 'running' then 'create' else 'update' end;
    update matches
    set kind = (p_result ->> 'kind')::match_kind,
        court_no = (p_result ->> 'court_no')::smallint,
        status = 'completed',
        winner = p_result ->> 'winner',
        completed_at = coalesce(completed_at, now())
    where id = v_id;
    perform write_match_players(v_id, p_result -> 'players');
    perform write_games(v_id, p_result -> 'games');
  end if;

  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  select s.group_id, request_actor(), 'match', v_id::text, v_action, v_before, match_snapshot(v_id)
  from sessions s where s.id = p_session;

  if p_next is not null then
    perform insert_match(p_session, p_next, 'running');
  end if;
  if p_queue is not null then
    update sessions set rotation_queue = p_queue where id = p_session;
  end if;
  return v_id;
end $$;

-- Batalkan match (tidak dihitung). Riwayat tetap ada.
create or replace function public.void_match(p_session uuid, p_match uuid, p_queue uuid[]) returns void
language plpgsql set search_path = public as $$
declare
  v_prev match_status;
  v_before jsonb;
begin
  select status into v_prev from matches where id = p_match and session_id = p_session for update;
  if not found then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;
  if v_prev = 'void' then
    return;
  end if;
  v_before := match_snapshot(p_match);
  update matches set status = 'void', winner = null where id = p_match;
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  select s.group_id, request_actor(), 'match', p_match::text, 'void', v_before, match_snapshot(p_match)
  from sessions s where s.id = p_session;
  if p_queue is not null then
    update sessions set rotation_queue = p_queue where id = p_session;
  end if;
end $$;

revoke execute on function public.match_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.write_match_players(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.write_games(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.insert_match(uuid, jsonb, match_status) from public, anon, authenticated;
revoke execute on function public.start_matches(uuid, jsonb, bigint, uuid[]) from public, anon, authenticated;
revoke execute on function public.set_live_score(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.record_result(uuid, uuid, jsonb, jsonb, uuid[]) from public, anon, authenticated;
revoke execute on function public.void_match(uuid, uuid, uuid[]) from public, anon, authenticated;
