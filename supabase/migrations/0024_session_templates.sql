-- 0024 — jadwal sesi mingguan otomatis (PRD S5, MEO-12). Template per grup; sesi 'Rencana' dibuat oleh job terjadwal
-- (endpoint terproteksi), idempoten per (template, tanggal WIB). Menghapus template tidak menghapus sesi yang sudah dibuat.

create table session_templates (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),   -- 0 = Minggu … 6 = Sabtu (WIB)
  start_time    time not null,                                       -- jam dinding WIB
  end_time      time not null check (end_time > start_time),
  venue         text check (char_length(venue) <= 80),
  court_count   smallint not null default 1 check (court_count between 1 and 12),
  play_mode     play_mode not null default 'kocok',
  court_per_hour integer check (court_per_hour between 0 and 100000000),  -- rupiah
  shuttle_cost  integer check (shuttle_cost between 0 and 100000000),     -- rupiah
  lead_days     smallint not null default 7 check (lead_days between 1 and 14),
  paused        boolean not null default false,
  created_by    uuid not null references members(id),
  created_at    timestamptz not null default now()
);
create index on session_templates (group_id);
alter table session_templates enable row level security;

alter table sessions
  add column template_id uuid references session_templates(id) on delete set null,
  add column template_date date;
create unique index sessions_template_date on sessions (template_id, template_date) where template_id is not null;

-- Edit template selalu menulis audit_log (pelaku dari header x-actor-member-id).
create or replace function public.audit_session_template() returns trigger
language plpgsql security definer set search_path = public as $$
begin
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

create trigger audit_session_template
  after insert or update or delete on session_templates
  for each row execute function public.audit_session_template();
revoke execute on function public.audit_session_template() from public, anon, authenticated;

-- Buat satu sesi dari template untuk satu tanggal. Mengembalikan null bila sesi (template, tanggal) sudah ada.
-- Peserta hadir disalin dari sesi terakhir template ini; RSVP dibiarkan kosong (terbuka).
create or replace function public.create_template_session(
  p_template uuid, p_date date, p_session jsonb, p_expenses jsonb
) returns uuid
language plpgsql set search_path = public as $$
declare
  t session_templates%rowtype;
  v_session uuid;
  v_prev uuid;
begin
  select * into t from session_templates where id = p_template for share;
  if not found or t.paused then return null; end if;

  select s.id into v_prev from sessions s
  where s.template_id = p_template and s.template_date < p_date
    and exists (select 1 from attendees a where a.session_id = s.id)
  order by s.template_date desc limit 1;

  insert into sessions (group_id, starts_at, venue, court_count, duration_min, play_mode, status, created_by, template_id, template_date)
  values (
    t.group_id,
    (p_session ->> 'starts_at')::timestamptz,
    t.venue, t.court_count,
    (p_session ->> 'duration_min')::smallint,
    t.play_mode, 'planned', t.created_by, t.id, p_date
  )
  on conflict (template_id, template_date) where template_id is not null do nothing
  returning id into v_session;
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
revoke execute on function public.create_template_session(uuid, date, jsonb, jsonb) from public, anon, authenticated;
