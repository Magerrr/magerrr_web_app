-- 0008 — mode fix_pasangan (PRD SC10c): pasangan tetap per sesi, lawan berganti.
-- [[member_a, member_b], …]; null = belum diatur. Divalidasi aplikasi (src/lib/core/fixed.ts).
alter table sessions add column fixed_pairs jsonb;
