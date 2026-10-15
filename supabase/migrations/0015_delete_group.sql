-- 0015 — hapus grup (MAGERRR-7). Semua tabel berantai dari groups, tetapi FK ke members tanpa ON DELETE
-- (attendees, match_players, expenses.paid_by, settlements, audit_log.actor_member_id, …) diperiksa sebelum
-- baris anak dari jalur sesi ikut terhapus. Karena itu hapus berurutan dalam satu transaksi:
-- sesi (attendees, match, biaya, pembayaran ikut), turnamen, audit, lalu grup (anggota, musim, obrolan, …).
-- Trigger audit biaya/pembayaran melewati baris yang sesinya sudah terhapus (v_group null).

create or replace function public.delete_group(p_group uuid) returns void
language plpgsql set search_path = public as $$
begin
  delete from sessions where group_id = p_group;
  delete from tournaments where group_id = p_group;
  delete from audit_log where group_id = p_group;
  delete from groups where id = p_group;
  if not found then
    raise exception 'grup % tidak ditemukan', p_group using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.delete_group(uuid) from public, anon, authenticated;
