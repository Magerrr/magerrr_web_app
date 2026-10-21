-- 0027 — RSVP "ikut" atomik untuk Jelajah (MAGERRR-19). Mengunci baris sesi, menolak sesi selesai, lalu upsert kehadiran
-- dengan rsvp = going. Idempoten: memanggil ulang tidak menggandakan baris dan tidak mengubah kolom present.

create or replace function public.rsvp_going(p_session uuid, p_member uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_status session_status;
begin
  select status into v_status from sessions where id = p_session for update;
  if not found then
    raise exception 'sesi % tidak ditemukan', p_session using errcode = 'P0002';
  end if;
  if v_status = 'finished' then
    raise exception 'sesi sudah selesai' using errcode = 'P0001';
  end if;
  insert into attendees (session_id, member_id, rsvp) values (p_session, p_member, 'going')
  on conflict (session_id, member_id) do update set rsvp = 'going';
end;
$$;

revoke execute on function public.rsvp_going(uuid, uuid) from public, anon, authenticated;
