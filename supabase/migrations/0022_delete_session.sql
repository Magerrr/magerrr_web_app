-- 0022 — hapus sesi (MAGERRR-17). Baris anak ikut terhapus berantai (kehadiran, match + game + pemain, biaya +
-- bagian, transfer, turnamen, pencatat skor; momen tetap ada tanpa sesi). Trigger audit biaya/pembayaran melewati
-- baris yang sesinya sudah terhapus (0005), jadi satu baris audit 'session'/'delete' mencatat ringkasan sebelum hapus:
-- waktu, tempat, status, iuran flat, jumlah match, biaya, dan transfer beserta status bayarnya.

create or replace function public.delete_session(p_session uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_group uuid;
  v_before jsonb;
begin
  select s.group_id,
    jsonb_build_object(
      'starts_at', s.starts_at,
      'venue', s.venue,
      'status', s.status,
      'flat_fee', s.flat_fee,
      'matches', (select count(*) from matches m where m.session_id = s.id),
      'expenses', coalesce((select jsonb_agg(jsonb_build_object('name', e.name, 'amount', e.amount, 'paid_by', e.paid_by) order by e.created_at)
        from expenses e where e.session_id = s.id), '[]'::jsonb),
      'settlements', coalesce((select jsonb_agg(jsonb_build_object('from', t.from_member, 'to', t.to_member, 'amount', t.amount, 'status', t.status))
        from settlements t where t.session_id = s.id), '[]'::jsonb)
    )
  into v_group, v_before
  from sessions s
  where s.id = p_session
  for update;
  if v_group is null then
    raise exception 'sesi % tidak ditemukan', p_session using errcode = 'P0002';
  end if;

  delete from sessions where id = p_session;
  insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
  values (v_group, request_actor(), 'session', p_session::text, 'delete', v_before, null);
end $$;

revoke execute on function public.delete_session(uuid) from public, anon, authenticated;
