-- 0023 — lokasi tempat sesi (MAGERRR-18): selain nama tempat (teks), sesi boleh punya tautan peta (mis. Google Maps)
-- atau titik yang dipilih di peta (cari / pin). Keduanya opsional; titik = lat & lng berpasangan.

alter table sessions
  add column venue_url text check (venue_url ~ '^https?://' and char_length(venue_url) <= 500),
  add column venue_lat double precision check (venue_lat between -90 and 90),
  add column venue_lng double precision check (venue_lng between -180 and 180),
  add constraint sessions_venue_point check ((venue_lat is null) = (venue_lng is null));

-- Buat sesi ikut menyimpan lokasi dalam transaksi yang sama (tanda tangan fungsi tetap).
create or replace function public.create_session(
  p_group uuid, p_creator uuid, p_session jsonb, p_attendees uuid[], p_expenses jsonb
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_session uuid;
begin
  insert into sessions (group_id, starts_at, venue, venue_url, venue_lat, venue_lng, court_count, duration_min, play_mode, rules, match_games, note, created_by)
  values (
    p_group,
    (p_session ->> 'starts_at')::timestamptz,
    p_session ->> 'venue',
    p_session ->> 'venue_url',
    (p_session ->> 'venue_lat')::double precision,
    (p_session ->> 'venue_lng')::double precision,
    (p_session ->> 'court_count')::smallint,
    (p_session ->> 'duration_min')::smallint,
    (p_session ->> 'play_mode')::play_mode,
    nullif(p_session -> 'rules', 'null'::jsonb),
    (p_session ->> 'match_games')::smallint,
    p_session ->> 'note',
    p_creator
  )
  returning id into v_session;

  insert into attendees (session_id, member_id, present)
  select v_session, m.id, true
  from members m
  where m.group_id = p_group and m.is_active and m.id = any(p_attendees);

  insert into expenses (session_id, name, amount, paid_by, mode, preset, meta)
  select v_session, e ->> 'name', (e ->> 'amount')::integer, p_creator, 'equal', e ->> 'preset', e -> 'meta'
  from jsonb_array_elements(coalesce(p_expenses, '[]'::jsonb)) e;

  return v_session;
end $$;

revoke execute on function public.create_session(uuid, uuid, jsonb, uuid[], jsonb) from public, anon, authenticated;
