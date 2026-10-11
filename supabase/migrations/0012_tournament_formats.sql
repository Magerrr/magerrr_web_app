-- 0012 — format turnamen: sistem gugur (0010), round robin, grup + gugur.
-- Grup peserta disimpan saat turnamen dibuat; klasemen grup & isi bagan tetap diturunkan
-- (src/lib/core/tournament.ts). Match round robin / fase grup tertaut ke pasangan seed (entry_a < entry_b).

alter table tournaments
  add column format        text not null default 'knockout' check (format in ('knockout', 'round_robin', 'groups_knockout')),
  add column group_count   smallint check (group_count in (2, 4, 8)),
  add column advance_count smallint check (advance_count in (1, 2)),
  add constraint tournaments_group_setup check ((format = 'groups_knockout') = (group_count is not null and advance_count is not null));

alter table tournament_entries
  add column group_no smallint check (group_no between 1 and 8);   -- 1 = Grup A; hanya grup + gugur

alter table matches
  add column entry_a smallint check (entry_a between 1 and 32),
  add column entry_b smallint check (entry_b between 1 and 32),
  drop constraint matches_bracket_slot,
  add constraint matches_tournament_link check (
    tournament_id is null
    or (bracket_round is not null and bracket_slot is not null and entry_a is null and entry_b is null)
    or (bracket_round is null and bracket_slot is null and entry_a is not null and entry_b is not null and entry_a < entry_b)
  );
-- Satu match (tidak dibatalkan) per pasangan seed.
create unique index matches_one_per_entry_pair on matches (tournament_id, entry_a, entry_b)
  where tournament_id is not null and entry_a is not null and status <> 'void';

-- insert_match (0010) + pasangan seed opsional: {"entry_a", "entry_b"}.
create or replace function public.insert_match(p_session uuid, p_match jsonb, p_status match_status) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_seq integer;
begin
  perform 1 from sessions where id = p_session for update; -- serialisasi nomor urut per sesi
  select coalesce(max(seq), 0) + 1 into v_seq from matches where session_id = p_session;
  insert into matches (session_id, seq, kind, court_no, status, winner, rules, games_max, completed_at,
                       tournament_id, bracket_round, bracket_slot, entry_a, entry_b)
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
    (p_match ->> 'bracket_slot')::smallint,
    (p_match ->> 'entry_a')::smallint,
    (p_match ->> 'entry_b')::smallint
  )
  returning id into v_id;
  perform write_match_players(v_id, p_match -> 'players');
  perform write_games(v_id, coalesce(p_match -> 'games', '[{"a": 0, "b": 0}]'::jsonb));
  return v_id;
end $$;

-- p_entries: [[member, member|null, group_no|null], …] urut seed 1…n. Audit entity 'tournament'.
drop function public.create_tournament(uuid, text, match_kind, text, jsonb, uuid);
create function public.create_tournament(
  p_session uuid, p_name text, p_kind match_kind, p_seeding text, p_format text,
  p_group_count integer, p_advance_count integer, p_entries jsonb, p_created_by uuid
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
  insert into tournaments (group_id, session_id, name, kind, seeding, format, group_count, advance_count, created_by)
  values (v_group, p_session, p_name, p_kind, p_seeding, p_format, p_group_count, p_advance_count, p_created_by)
  returning id into v_id;
  insert into tournament_entries (tournament_id, seed, player1, player2, group_no)
  select v_id, e.ord::smallint, (e.value ->> 0)::uuid, (e.value ->> 1)::uuid, (e.value ->> 2)::smallint
  from jsonb_array_elements(p_entries) with ordinality e(value, ord);
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (v_group, request_actor(), 'tournament', v_id::text, 'create', null,
          jsonb_build_object('name', p_name, 'kind', p_kind, 'seeding', p_seeding, 'format', p_format,
                             'group_count', p_group_count, 'advance_count', p_advance_count, 'entries', p_entries));
  return v_id;
end $$;

-- Hapus turnamen yang belum punya match berjalan/selesai; match yang dibatalkan dilepas dari turnamen.
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
  select coalesce(jsonb_agg(jsonb_build_array(player1, player2, group_no) order by seed), '[]'::jsonb) into v_entries
  from tournament_entries where tournament_id = p_tournament;
  update matches set tournament_id = null, bracket_round = null, bracket_slot = null, entry_a = null, entry_b = null
  where tournament_id = p_tournament;
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (v_row.group_id, request_actor(), 'tournament', p_tournament::text, 'delete',
          jsonb_build_object('name', v_row.name, 'kind', v_row.kind, 'seeding', v_row.seeding, 'format', v_row.format,
                             'group_count', v_row.group_count, 'advance_count', v_row.advance_count, 'entries', v_entries), null);
  delete from tournaments where id = p_tournament;
end $$;

revoke execute on function public.insert_match(uuid, jsonb, match_status) from public, anon, authenticated;
revoke execute on function public.create_tournament(uuid, text, match_kind, text, text, integer, integer, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.delete_tournament(uuid) from public, anon, authenticated;
