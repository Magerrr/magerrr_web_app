-- 0009 — maskot Kiko. XP, level, dan streak diturunkan dari match & kehadiran (src/lib/core/mascot.ts);
-- yang disimpan hanya pilihan kostum anggota. null = kostum otomatis sesuai level.
-- {"fur": "...", "hat": "...", "acc": "...", "jersey": "..."}; kunci & nilai divalidasi aplikasi.
alter table members
  add column kiko jsonb,
  add constraint members_kiko_object check (kiko is null or jsonb_typeof(kiko) = 'object');
