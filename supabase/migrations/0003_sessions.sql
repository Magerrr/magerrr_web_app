-- 0003 — sesi & kehadiran (BUILD_PLAN Fase 3)

-- Buat sesi + peserta hadir + biaya awal (sewa lapangan / kok) dalam satu transaksi.
-- Biaya dibayar (ditalangi) oleh pembuat sesi dan dibagi rata ke peserta hadir; rinciannya
-- dihitung di aplikasi (src/lib/core/split.ts) dan bisa diubah di halaman Patungan.
create or replace function public.create_session(
  p_group uuid, p_creator uuid, p_session jsonb, p_attendees uuid[], p_expenses jsonb
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_session uuid;
begin
  insert into sessions (group_id, starts_at, venue, court_count, duration_min, play_mode, rules, match_games, note, created_by)
  values (
    p_group,
    (p_session ->> 'starts_at')::timestamptz,
    p_session ->> 'venue',
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

-- Audit biaya (CLAUDE.md: edit biaya selalu menulis audit_log). Pelaku dari header x-actor-member-id.
create or replace function public.audit_expense() returns trigger
language plpgsql set search_path = public as $$
declare
  v_group uuid;
begin
  select group_id into v_group from sessions where id = coalesce(new.session_id, old.session_id);
  -- Sesi/grup sedang dihapus (cascade): tak ada grup untuk dicatat.
  if v_group is null then
    return coalesce(new, old);
  end if;
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (
    v_group,
    request_actor(),
    'expense',
    coalesce(new.id, old.id)::text,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_expense
  after insert or update or delete on expenses
  for each row execute function public.audit_expense();

create index on attendees (member_id);
create index on expenses (session_id);

revoke execute on function public.create_session(uuid, uuid, jsonb, uuid[], jsonb) from public, anon, authenticated;
revoke execute on function public.audit_expense() from public, anon, authenticated;
