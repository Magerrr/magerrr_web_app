-- 0010 — turnamen sistem gugur (bagan) di dalam satu sesi.
-- Bagan tidak disimpan: diturunkan dari peserta ber-seed + match yang tertaut ke slot (src/lib/core/bracket.ts).
-- Match turnamen adalah match biasa di sesi itu (skor, audit, klasemen sama).

create table tournaments (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  session_id    uuid not null unique references sessions(id) on delete cascade,  -- satu turnamen per sesi
  name          text not null check (char_length(name) between 1 and 60),
  kind          match_kind not null,
  seeding       text not null check (seeding in ('rating', 'random')),
  created_by    uuid references members(id),
  created_at    timestamptz not null default now()
);
create index on tournaments (group_id);

create table tournament_entries (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  seed          smallint not null check (seed between 1 and 32),
  player1       uuid not null references members(id) on delete cascade,
  player2       uuid references members(id) on delete cascade,             -- null = tunggal
  primary key (tournament_id, seed)
);

alter table matches
  add column tournament_id uuid references tournaments(id) on delete set null,
  add column bracket_round smallint check (bracket_round between 1 and 5),
  add column bracket_slot  smallint check (bracket_slot between 0 and 15),
  add constraint matches_bracket_slot check (tournament_id is null or (bracket_round is not null and bracket_slot is not null));
-- Satu match (tidak dibatalkan) per slot bagan.
create unique index matches_one_per_bracket_slot on matches (tournament_id, bracket_round, bracket_slot)
  where tournament_id is not null and status <> 'void';

alter table tournaments        enable row level security;
alter table tournament_entries enable row level security;

-- insert_match (0004) + kolom slot bagan opsional: {"tournament_id", "bracket_round", "bracket_slot"}.
create or replace function public.insert_match(p_session uuid, p_match jsonb, p_status match_status) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_seq integer;
begin
  perform 1 from sessions where id = p_session for update; -- serialisasi nomor urut per sesi
  select coalesce(max(seq), 0) + 1 into v_seq from matches where session_id = p_session;
  insert into matches (session_id, seq, kind, court_no, status, winner, rules, games_max, completed_at, tournament_id, bracket_round, bracket_slot)
  values (
    p_session, v_seq,
    (p_match ->> 'kind')::match_kind,
    (p_match ->> 'court_no')::smallint,
    p_status,
    p_match ->> 'winner',
    nullif(p_match -> 'rules', 'null'::jsonb),
    (p_match ->> 'games_max')::smallint,
    case when p_status = 'completed' then now() end,
    (p_match ->> 'tournament_id')::uuid,
    (p_match ->> 'bracket_round')::smallint,
    (p_match ->> 'bracket_slot')::smallint
  )
  returning id into v_id;
  perform write_match_players(v_id, p_match -> 'players');
  perform write_games(v_id, coalesce(p_match -> 'games', '[{"a": 0, "b": 0}]'::jsonb));
  return v_id;
end $$;

-- p_entries: [[member, member|null], …] urut seed 1…n. Audit entity 'tournament'.
create or replace function public.create_tournament(
  p_session uuid, p_name text, p_kind match_kind, p_seeding text, p_entries jsonb, p_created_by uuid
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_group uuid;
  v_id uuid;
begin
  select group_id into v_group from sessions where id = p_session for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;
  insert into tournaments (group_id, session_id, name, kind, seeding, created_by)
  values (v_group, p_session, p_name, p_kind, p_seeding, p_created_by)
  returning id into v_id;
  insert into tournament_entries (tournament_id, seed, player1, player2)
  select v_id, e.ord::smallint, (e.value ->> 0)::uuid, (e.value ->> 1)::uuid
  from jsonb_array_elements(p_entries) with ordinality e(value, ord);
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (v_group, request_actor(), 'tournament', v_id::text, 'create', null,
          jsonb_build_object('name', p_name, 'kind', p_kind, 'seeding', p_seeding, 'entries', p_entries));
  return v_id;
end $$;

-- Hapus turnamen yang belum punya match berjalan/selesai; match yang dibatalkan dilepas dari bagan.
create or replace function public.delete_tournament(p_tournament uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_row tournaments;
  v_entries jsonb;
begin
  select * into v_row from tournaments where id = p_tournament for update;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from matches where tournament_id = p_tournament and status <> 'void') then
    raise exception 'tournament_has_matches' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_array(player1, player2) order by seed), '[]'::jsonb) into v_entries
  from tournament_entries where tournament_id = p_tournament;
  update matches set tournament_id = null, bracket_round = null, bracket_slot = null where tournament_id = p_tournament;
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (v_row.group_id, request_actor(), 'tournament', p_tournament::text, 'delete',
          jsonb_build_object('name', v_row.name, 'kind', v_row.kind, 'seeding', v_row.seeding, 'entries', v_entries), null);
  delete from tournaments where id = p_tournament;
end $$;

revoke execute on function public.insert_match(uuid, jsonb, match_status) from public, anon, authenticated;
revoke execute on function public.create_tournament(uuid, text, match_kind, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.delete_tournament(uuid) from public, anon, authenticated;
