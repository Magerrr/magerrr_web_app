-- 0026 — sesi berulang tanpa cron (MEO-12, revisi atas permintaan pengguna). Template 0024 menjadi "seri": host memilih
-- Ulangi Mingguan / Bulanan (tanggal sama atau hari sama di minggu ke-N) saat membuat sesi. Sesi berikutnya dibuat saat
-- aplikasi dibuka (server), menyalin sesi terakhir seri itu; tidak ada job terjadwal. Isi sesi (jam, tempat, lapangan,
-- aturan) tidak lagi disimpan di template. Template 0024 belum pernah dirilis, jadi isinya dibuang.

alter table session_templates disable trigger audit_session_template;
update sessions set template_id = null, template_date = null where template_id is not null;
delete from session_templates;
alter table session_templates enable trigger audit_session_template;

alter table session_templates
  drop column weekday,
  drop column start_time,
  drop column end_time,
  drop column venue,
  drop column court_count,
  drop column play_mode,
  drop column lead_days,
  add column frequency   text not null check (frequency in ('weekly', 'monthly')),
  add column monthly_by  text check (monthly_by in ('date', 'weekday')),   -- hanya bulanan
  add column anchor_date date not null,                                    -- tanggal sesi pertama (WIB); dasar hitungan
  add column last_date   date not null,                                    -- tanggal terakhir yang pernah dibuat
  add column ahead       smallint not null default 1 check (ahead between 1 and 4),  -- sesi mendatang yang disiapkan
  add constraint session_templates_monthly_by check ((frequency = 'monthly') = (monthly_by is not null));

-- Edit seri menulis audit_log; majunya last_date saat sesi dibuat bukan edit, jadi tidak dicatat. Saat grup dihapus
-- (template ikut terhapus berantai) tidak ada yang dicatat karena grupnya sudah tidak ada.
create or replace function public.audit_session_template() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'last_date') = (to_jsonb(new) - 'last_date') then return new; end if;
  if tg_op = 'DELETE' and not exists (select 1 from groups where id = old.group_id) then return old; end if;
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (
    coalesce(new.group_id, old.group_id),
    request_actor(),
    'session_template',
    coalesce(new.id, old.id)::text,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- Jadikan sesi awal sebuah seri. Tanggal awal = tanggal sesi (WIB). Sesi yang sudah ikut seri lain ditolak.
create or replace function public.create_session_series(p_session uuid, p_series jsonb, p_creator uuid) returns uuid
language plpgsql set search_path = public as $$
declare
  s sessions%rowtype;
  v_date date;
  v_series uuid;
begin
  select * into s from sessions where id = p_session for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if s.template_id is not null then raise exception 'already_series' using errcode = 'P0001'; end if;
  v_date := (s.starts_at at time zone 'Asia/Jakarta')::date;

  insert into session_templates (group_id, frequency, monthly_by, anchor_date, last_date, ahead, court_per_hour, shuttle_cost, created_by)
  values (
    s.group_id,
    p_series ->> 'frequency',
    p_series ->> 'monthly_by',
    v_date, v_date,
    (p_series ->> 'ahead')::smallint,
    (p_series ->> 'court_per_hour')::integer,
    (p_series ->> 'shuttle_cost')::integer,
    p_creator
  )
  returning id into v_series;
  update sessions set template_id = v_series, template_date = v_date where id = p_session;
  return v_series;
end $$;
revoke execute on function public.create_session_series(uuid, jsonb, uuid) from public, anon, authenticated;

-- Buat satu sesi Rencana seri untuk satu tanggal, menyalin `p_source` (sesi terakhir seri): tempat, lapangan, durasi,
-- mode, aturan, catatan, cara patungan; jam mulai = jam WIB sesi sumber. Peserta hadir disalin dari sesi terakhir seri
-- yang punya peserta; RSVP kosong (terbuka). Mengembalikan null bila seri dijeda/dihapus atau tanggal itu sudah pernah
-- dibuat (tanggal ≤ last_date, termasuk yang lalu dihapus host), sehingga pemanggilan berulang/serentak tidak dobel.
drop function public.create_template_session(uuid, date, jsonb, jsonb);
create or replace function public.create_series_session(p_series uuid, p_date date, p_source uuid, p_expenses jsonb) returns uuid
language plpgsql set search_path = public as $$
declare
  t session_templates%rowtype;
  src sessions%rowtype;
  v_prev uuid;
  v_session uuid;
begin
  select * into t from session_templates where id = p_series for update;
  if not found or t.paused or p_date <= t.last_date then return null; end if;
  select * into src from sessions where id = p_source and template_id = p_series;
  if not found then return null; end if;

  select s.id into v_prev from sessions s
  where s.template_id = p_series
    and exists (select 1 from attendees a where a.session_id = s.id and a.present)
  order by s.template_date desc limit 1;

  insert into sessions (
    group_id, starts_at, venue, venue_url, venue_lat, venue_lng, court_count, duration_min, play_mode, rules, match_games,
    note, flat_fee, shuttle_price_per_slop, shuttle_per_slop, status, created_by, template_id, template_date
  )
  values (
    src.group_id,
    (p_date + (src.starts_at at time zone 'Asia/Jakarta')::time) at time zone 'Asia/Jakarta',
    src.venue, src.venue_url, src.venue_lat, src.venue_lng, src.court_count, src.duration_min, src.play_mode, src.rules,
    src.match_games, src.note, src.flat_fee, src.shuttle_price_per_slop, src.shuttle_per_slop,
    'planned', t.created_by, t.id, p_date
  )
  on conflict (template_id, template_date) where template_id is not null do nothing
  returning id into v_session;
  update session_templates set last_date = p_date where id = p_series;
  if v_session is null then return null; end if;

  insert into attendees (session_id, member_id, present)
  select v_session, a.member_id, true
  from attendees a join members m on m.id = a.member_id
  where a.session_id = v_prev and a.present and m.is_active and m.role <> 'referee';

  insert into expenses (session_id, name, amount, paid_by, mode, preset, meta)
  select v_session, e ->> 'name', (e ->> 'amount')::integer, t.created_by, 'equal', e ->> 'preset', e -> 'meta'
  from jsonb_array_elements(coalesce(p_expenses, '[]'::jsonb)) e;

  return v_session;
end $$;
revoke execute on function public.create_series_session(uuid, date, uuid, jsonb) from public, anon, authenticated;
