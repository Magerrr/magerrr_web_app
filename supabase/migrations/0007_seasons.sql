-- 0007 — musim (PRD L9, BUILD_PLAN Fase 9).
-- Sesi masuk musim menurut tanggal WIB-nya (starts_on ≤ tanggal ≤ ends_on, ends_on null = masih berjalan).
-- Klasemen musim tetap diturunkan dari match (period {kind:'season'}); tidak ada angka yang disimpan.

alter table seasons
  add constraint seasons_name_length check (char_length(name) between 1 and 60),
  add constraint seasons_range check (ends_on is null or ends_on >= starts_on);

-- Paling banyak satu musim berjalan per grup.
create unique index seasons_one_open on seasons (group_id) where closed_at is null;
create index on seasons (group_id, starts_on desc);
create index on sessions (season_id);

-- Tetapkan ulang sessions.season_id semua sesi grup dari rentang tanggal musim (musim mulai terakhir menang bila tumpang tindih).
create or replace function public.assign_seasons(p_group uuid) returns void
language sql set search_path = public as $$
  update sessions s
  set season_id = (
    select se.id from seasons se
    where se.group_id = s.group_id
      and (s.starts_at at time zone 'Asia/Jakarta')::date >= se.starts_on
      and (se.ends_on is null or (s.starts_at at time zone 'Asia/Jakarta')::date <= se.ends_on)
    order by se.starts_on desc, se.id
    limit 1
  )
  where s.group_id = p_group
$$;

revoke execute on function public.assign_seasons(uuid) from public, anon, authenticated;
