# Matching Partner — usulan desain (riset)

Status: usulan, belum diimplementasi. Berasal dari issue #2 (Linear MAGERRR-24). Di luar P0 — jangan dikerjakan sebelum semua P0 hijau (CLAUDE.md).

## 1. Tujuan & data yang sudah ada
Membantu pemain menemukan **partner/lawan main yang cocok**, bukan hanya di dalam satu grup. Data yang sudah tersedia:
- `members.grade` (A–D, diatur admin grup) dan rating turunan dari match (`src/lib/core/standings.ts`, `kocok.ts`).
- `sessions.venue`, `venue_lat/lng` (migrasi 0023), `starts_at`, `attendees.rsvp`.
- `matches`/`match_players` → riwayat siapa pernah main bersama/melawan (`player.ts`: form, head-to-head).
- `groups.is_public` + `/jelajah` (0017); `profiles` (nama, avatar).

Catatan: `members` dibuat per grup dan boleh tamu; identitas lintas grup hanya lewat `profiles` (`members.user_id`). Matching hanya untuk user ber-akun.

## 2. Kriteria matching
Skor 0–100 dari bobot, dihitung sebagai **fungsi murni** di `src/lib/core/matching.ts` (tanpa IO/acak; waktu sebagai argumen), diturunkan setiap kali, tidak disimpan.
1. **Level (bobot ~40)** — rating turunan dari match bila ≥ N match selesai; jika kurang, pakai `grade` terendah/rata-rata dari grup-grup user; jika tidak ada, level yang dipilih sendiri. Jarak level kecil = skor tinggi.
2. **Lokasi (~25)** — jarak haversine antara titik area main user dan venue yang sering dipakai kandidat; fallback ke kota/teks.
3. **Jadwal (~20)** — irisan slot ketersediaan (hari × jam, WIB) dengan kandidat, plus pola `sessions.starts_at` yang pernah dihadiri.
4. **Riwayat (~10)** — bonus untuk yang belum pernah berpasangan (variasi) atau punya kecocokan win-rate seimbang; penalti untuk yang pernah diblokir/ditolak.
5. **Preferensi (~5)** — mode (ganda/tunggal), `play_mode` favorit.

Hard filter (bukan skor): kandidat harus opt-in, tidak diblokir, dan level dalam rentang yang diizinkan kedua pihak.

## 3. Perubahan skema Supabase (migrasi baru, mis. `0024_matching.sql`)
Mengikuti pola yang ada: RLS deny-all, akses lewat service role di `src/lib/db/`.
- `profiles` + kolom: `mm_enabled boolean default false` (opt-in), `mm_level smallint` (1–5, opsional), `mm_home_lat/lng double precision` (dibulatkan ~1 km), `mm_radius_km smallint`, `mm_bio text`.
- `partner_availability(user_id, weekday smallint, start_min smallint, end_min smallint)` — slot mingguan, zona `Asia/Jakarta`.
- `partner_requests(id, from_user, to_user, session_id null, message, status enum('pending','accepted','declined','cancelled'), created_at, responded_at)` + unique parsial untuk satu request `pending` per pasangan.
- `partner_blocks(user_id, blocked_user_id)`.
- Opsional: `sessions.open_slots smallint` agar sesi publik bisa mencari pemain tambahan.
- Tanpa tabel skor/klasemen baru; semua pencocokan diturunkan dari data match. Aksi yang mengubah data tidak menyentuh skor/biaya, sehingga `audit_log` tidak wajib (pertimbangkan untuk blok/terima).

## 4. Alur UI singkat (Bahasa Indonesia)
1. **`/profil` → "Cari Partner"**: toggle opt-in, level, area (pin peta, memakai komponen peta sesi), radius, slot jadwal, bio. Tampilkan jelas apa yang terlihat orang lain.
2. **`/partner`**: daftar rekomendasi (kartu: nama, avatar, level, jarak kasar, irisan jadwal, alasan "Level setara · 2 km · Sabtu pagi"). Filter level/jarak/hari.
3. **Aksi**: "Ajak Main" (kirim request + pesan singkat, opsional pilih sesi), "Sembunyikan", "Blokir/Laporkan".
4. **`/partner/permintaan`**: masuk/keluar; terima/tolak. Setelah diterima, kontak dibuka lewat undangan ke grup/sesi (pakai `invite_code`) — bukan membagikan nomor langsung.
5. **Sesi publik**: tombol "Cari pemain" menandai `open_slots`, menampilkan kandidat cocok ke admin.

## 5. Risiko
- **Privasi lokasi**: koordinat rumah sensitif → simpan dibulatkan, jangan pernah tampilkan titik tepat/nama grup privat.
- **Penyalahgunaan/pelecehan**: perlu opt-in, blokir, laporan, batas request harian (rate limit di server).
- **Cold start**: kandidat sedikit di awal; rating butuh data match, `grade` bersifat subjektif per grup dan tidak sebanding antar grup.
- **Tamu** (`user_id` null) tidak bisa dicocokkan.
- **Keamanan**: semua endpoint tulis divalidasi di server; jangan bocorkan keanggotaan grup privat lewat rekomendasi.
- **Cakupan**: dokumen ini di luar P0; PRD perlu requirement ber-ID baru sebelum implementasi.

## 6. Pertanyaan terbuka
1. Cakupan: hanya kenalan satu grup/kota, atau pencarian publik lintas kota?
2. Satuan "partner": pasangan ganda tetap, lawan sparring, atau pengisi slot sesi?
3. Sumber level: self-declared, `grade` admin, atau rating otomatis (dan bagaimana menormalkan antar grup)?
4. Apakah lokasi cukup teks kota, atau perlu peta + radius?
5. Kanal komunikasi setelah match: chat internal (0011 sudah ada untuk grup) atau hanya undangan grup?
6. Perlu moderasi manual/laporan sejak awal?
7. Bobot di atas hanya tebakan awal — perlu dikalibrasi dengan data nyata.
