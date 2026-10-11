-- 0006 — kok per slop (BUILD_PLAN Fase 9, ALGORITHMS §5.5, design/README #7).
-- Penghitung kok di papan skor; saat sesi ditutup menjadi satu biaya patungan (shuttleCost).
alter table sessions
  add column shuttle_price_per_slop integer check (shuttle_price_per_slop between 0 and 10000000),
  add column shuttle_per_slop smallint not null default 12 check (shuttle_per_slop between 1 and 50),
  add column shuttles_used smallint not null default 0 check (shuttles_used between 0 and 999);
