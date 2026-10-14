-- 0014 — pihak yang servis pada match berjalan (ALGORITHMS §1e), dicatat bersama skor live.
-- null = belum diketahui. Tidak diaudit (sama dengan poin live).

alter table matches add column serving text check (serving in ('A', 'B'));

drop function public.set_live_score(uuid, jsonb);
create function public.set_live_score(p_match uuid, p_games jsonb, p_serving text) returns void
language plpgsql set search_path = public as $$
begin
  perform 1 from matches where id = p_match and status = 'running' for update;
  if not found then
    raise exception 'match_not_running' using errcode = 'P0001';
  end if;
  perform write_games(p_match, p_games);
  update matches set serving = p_serving where id = p_match;
end $$;

revoke execute on function public.set_live_score(uuid, jsonb, text) from public, anon, authenticated;
