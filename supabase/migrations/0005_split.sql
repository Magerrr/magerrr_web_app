-- 0005 — patungan (BUILD_PLAN Fase 6). Tanpa pemrosesan uang: hanya pencatatan.
--
-- Pembagian (shareExpense → computeNet → applyRounding → settle) dihitung di aplikasi
-- (src/lib/core/split.ts). Fungsi di sini menyimpan hasilnya secara atomik: biaya, bagian per
-- orang (expense_shares), kehadiran (opsional), dan transfer (settlements), lalu mencatat audit.

-- true = biaya dibagi rata ke semua peserta hadir dan ikut berubah saat kehadiran berubah.
-- false = bagian tetap: peserta terpilih (equal), nominal per orang (custom), atau bobot (weighted).
alter table expenses add column split_all boolean not null default true;

-- Naik setiap kali tagihan sesi disimpan; mencegah dua admin menimpa perhitungan satu sama lain.
alter table sessions add column bill_version integer not null default 0;

create index on expense_shares (member_id);
create index on settlements (from_member);
create index on payment_infos (member_id);

-- Snapshot biaya beserta bagian tiap orang (audit_log before/after).
create or replace function public.expense_snapshot(p_expense uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'name', e.name,
    'amount', e.amount,
    'paid_by', e.paid_by,
    'mode', e.mode,
    'preset', e.preset,
    'split_all', e.split_all,
    'meta', e.meta,
    'shares', coalesce((select jsonb_object_agg(s.member_id, s.amount) from expense_shares s where s.expense_id = e.id), '{}'::jsonb),
    'weights', (select jsonb_object_agg(s.member_id, s.weight) from expense_shares s where s.expense_id = e.id and s.weight is not null)
  )
  from expenses e where e.id = p_expense
$$;

-- Trigger audit biaya (0003) dilewati saat save_bill mencatat audit sendiri (dengan bagian per orang).
create or replace function public.audit_expense() returns trigger
language plpgsql set search_path = public as $$
declare
  v_group uuid;
begin
  if current_setting('magerrr.audit_explicit', true) = 'on' then
    return coalesce(new, old);
  end if;
  select group_id into v_group from sessions where id = coalesce(new.session_id, old.session_id);
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

-- Audit status bayar: tandai lunas / batal / "saya sudah bayar" / reset karena nominal berubah / transfer hilang.
create or replace function public.audit_payment() returns trigger
language plpgsql set search_path = public as $$
declare
  v_group uuid;
begin
  select group_id into v_group from sessions where id = coalesce(new.session_id, old.session_id);
  if v_group is null then
    return coalesce(new, old);
  end if;
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (
    v_group,
    request_actor(),
    'payment',
    coalesce(new.id, old.id)::text,
    case tg_op when 'UPDATE' then 'update' else 'delete' end,
    to_jsonb(old),
    case when tg_op = 'UPDATE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_payment_update
  after update on settlements
  for each row
  when (old.status is distinct from new.status or old.self_reported is distinct from new.self_reported or old.amount is distinct from new.amount)
  execute function public.audit_payment();

create trigger audit_payment_delete
  after delete on settlements
  for each row
  when (old.status = 'paid' or old.self_reported)
  execute function public.audit_payment();

-- Simpan tagihan sesi dalam satu transaksi.
--   p_op        : 'create' | 'update' | 'delete' | 'recompute'
--   p_expense   : {id, name, amount, paid_by, mode, preset, meta, split_all} (create/update), {id} (delete), null (recompute)
--   p_shares    : [{expense_id, member_id, amount, weight}] — bagian SEMUA biaya sesi setelah perubahan
--   p_settlements: [{from, to, amount, status, self_reported, paid_at}] — hasil reconcileSettlements
--   p_present   : peserta hadir baru (null = kehadiran tidak diubah)
--   p_version   : sessions.bill_version yang dibaca aplikasi; berbeda → 'bill_conflict'
create or replace function public.save_bill(
  p_session uuid, p_op text, p_expense jsonb, p_shares jsonb, p_settlements jsonb, p_present uuid[], p_version integer
) returns integer
language plpgsql set search_path = public as $$
declare
  v_group uuid;
  v_version integer;
  v_id uuid := (p_expense ->> 'id')::uuid;
  v_before jsonb;
begin
  select group_id, bill_version into v_group, v_version from sessions where id = p_session for update;
  if v_group is null then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;
  if v_version <> p_version then
    raise exception 'bill_conflict' using errcode = 'P0001';
  end if;
  perform set_config('magerrr.audit_explicit', 'on', true);

  if p_op in ('update', 'delete') then
    v_before := expense_snapshot(v_id);
    if v_before is null or not exists (select 1 from expenses where id = v_id and session_id = p_session) then
      raise exception 'expense_not_found' using errcode = 'P0001';
    end if;
  end if;

  if p_op = 'create' then
    insert into expenses (id, session_id, name, amount, paid_by, mode, preset, meta, split_all)
    values (
      v_id, p_session, p_expense ->> 'name', (p_expense ->> 'amount')::integer, (p_expense ->> 'paid_by')::uuid,
      (p_expense ->> 'mode')::split_mode, p_expense ->> 'preset', nullif(p_expense -> 'meta', 'null'::jsonb),
      (p_expense ->> 'split_all')::boolean
    );
  elsif p_op = 'update' then
    update expenses set
      name = p_expense ->> 'name',
      amount = (p_expense ->> 'amount')::integer,
      paid_by = (p_expense ->> 'paid_by')::uuid,
      mode = (p_expense ->> 'mode')::split_mode,
      preset = p_expense ->> 'preset',
      meta = nullif(p_expense -> 'meta', 'null'::jsonb),
      split_all = (p_expense ->> 'split_all')::boolean
    where id = v_id;
  elsif p_op = 'delete' then
    delete from expenses where id = v_id;
  elsif p_op <> 'recompute' then
    raise exception 'bad_op' using errcode = 'P0001';
  end if;

  if p_present is not null then
    insert into attendees (session_id, member_id, present)
    select p_session, m.id, true from members m
    where m.group_id = v_group and m.is_active and m.id = any(p_present)
    on conflict (session_id, member_id) do update set present = true;
    update attendees set present = false where session_id = p_session and not (member_id = any(p_present));
  end if;

  delete from expense_shares s using expenses e where s.expense_id = e.id and e.session_id = p_session;
  insert into expense_shares (expense_id, member_id, amount, weight)
  select (x ->> 'expense_id')::uuid, (x ->> 'member_id')::uuid, (x ->> 'amount')::integer, (x ->> 'weight')::integer
  from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) x;

  -- Transfer yang hilang dihapus; yang tetap diperbarui (trigger mencatat perubahan status/nominal).
  delete from settlements st
  where st.session_id = p_session
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_settlements, '[]'::jsonb)) x
      where (x ->> 'from')::uuid = st.from_member and (x ->> 'to')::uuid = st.to_member
    );
  insert into settlements (session_id, from_member, to_member, amount, status, self_reported, paid_at)
  select p_session, (x ->> 'from')::uuid, (x ->> 'to')::uuid, (x ->> 'amount')::integer,
         (x ->> 'status')::pay_status, (x ->> 'self_reported')::boolean, (x ->> 'paid_at')::timestamptz
  from jsonb_array_elements(coalesce(p_settlements, '[]'::jsonb)) x
  on conflict (session_id, from_member, to_member) do update set
    amount = excluded.amount, status = excluded.status, self_reported = excluded.self_reported, paid_at = excluded.paid_at;

  if p_op <> 'recompute' then
    insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
    values (v_group, request_actor(), 'expense', v_id::text, p_op, v_before, case when p_op <> 'delete' then expense_snapshot(v_id) end);
  end if;

  update sessions set bill_version = bill_version + 1 where id = p_session;
  return v_version + 1;
end $$;

-- Ubah status satu transfer. p_action: 'paid' | 'unpaid' | 'reject' (tolak laporan) | 'self_report'.
-- p_paid_at diberikan aplikasi. Mengembalikan false bila transfer tidak ada / aksi tidak berlaku.
create or replace function public.set_payment_status(p_session uuid, p_settlement uuid, p_action text, p_paid_at timestamptz)
returns boolean
language plpgsql set search_path = public as $$
declare
  v_row settlements;
begin
  perform 1 from sessions where id = p_session for update;
  select * into v_row from settlements where id = p_settlement and session_id = p_session for update;
  if v_row.id is null then
    return false;
  end if;
  if p_action = 'paid' then
    update settlements set status = 'paid', self_reported = false, paid_at = coalesce(v_row.paid_at, p_paid_at) where id = v_row.id;
  elsif p_action = 'unpaid' then
    update settlements set status = 'unpaid', self_reported = false, paid_at = null where id = v_row.id;
  elsif p_action = 'reject' then
    if not v_row.self_reported then return false; end if;
    update settlements set self_reported = false where id = v_row.id;
  elsif p_action = 'self_report' then
    if v_row.status = 'paid' then return false; end if;
    update settlements set self_reported = true where id = v_row.id;
  else
    return false;
  end if;
  update sessions set bill_version = bill_version + 1 where id = p_session;
  return true;
end $$;

-- Gambar QRIS di Supabase Storage (privat; dibaca lewat route server). Dilewati bila skema storage tidak ada (db:check).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('qris', 'qris', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;

revoke execute on function public.expense_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.audit_payment() from public, anon, authenticated;
revoke execute on function public.save_bill(uuid, text, jsonb, jsonb, jsonb, uuid[], integer) from public, anon, authenticated;
revoke execute on function public.set_payment_status(uuid, uuid, text, timestamptz) from public, anon, authenticated;
