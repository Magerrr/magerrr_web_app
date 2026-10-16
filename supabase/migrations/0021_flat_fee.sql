-- 0021 — iuran flat (MAGERRR-14, ALGORITHMS §5.7): cara patungan per sesi. null = bagi rata (bawaan);
-- angka = tiap peserta hadir membayar nominal tetap ke pengelola sesi, yang menanggung biaya & selisihnya.
-- Tagihan (expense_shares, settlements) tetap dihitung di server lewat save_bill.

alter table sessions add column flat_fee integer check (flat_fee between 1 and 10000000);

-- Audit perubahan cara patungan (biaya → wajib audit_log), pelaku dari header x-actor-member-id.
create or replace function public.audit_flat_fee() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.flat_fee is distinct from new.flat_fee then
    insert into audit_log (group_id, actor_member_id, entity, entity_id, action, before, after)
    values (new.group_id, request_actor(), 'flat_fee', new.id::text, 'update',
      jsonb_build_object('flat_fee', old.flat_fee), jsonb_build_object('flat_fee', new.flat_fee));
  end if;
  return new;
end $$;

create trigger audit_flat_fee
  after update of flat_fee on sessions
  for each row execute function public.audit_flat_fee();

revoke execute on function public.audit_flat_fee() from public, anon, authenticated;
