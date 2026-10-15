-- 0016 — peran wasit (MAGERRR-11). Urutan enum admin < referee < member dipakai daftar anggota (order by role).
-- Wasit (wajib akun, sama seperti admin) mengurus permainan: kocok/mulai ronde, catat & ubah skor, batalkan match,
-- pasangan tetap, mulai match turnamen, pencatat skor lapangan. Pengaturan grup, anggota, sesi, patungan, kok tetap admin.
-- Otorisasi di server Next.js (src/lib/db/authz.ts), bukan di database.
alter type member_role add value if not exists 'referee' before 'member';
