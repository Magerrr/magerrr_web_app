# CLAUDE.md — Magerrr (MVP)

Aplikasi mabar badminton: sesi main → skor → leaderboard → patungan → recap.
Dibangun oleh Claude Code. **Baca dokumen ini penuh sebelum menulis kode.**

## Urutan baca (wajib)
1. `docs/PRD.md` — apa & kenapa, requirement ber-ID (G*, S*, SC*, L*, P*, R*), prioritas P0/P1/P2.
2. `docs/ALGORITHMS.md` — spesifikasi pasti + **test vector** untuk aturan skor, klasemen, rotasi/kocok, patungan. Ini sumber kebenaran logika.
3. `docs/DATA_MODEL.sql` — skema Postgres (Supabase).
4. `docs/BUILD_PLAN.md` — fase kerja berurutan, tiap fase punya acceptance criteria. **Kerjakan berurutan, jangan loncat.**
5. `docs/design/README.md` — peta layar desain → fitur, plus catatan cacat desain. File desain asli di `docs/design/project/`.

Jika dua dokumen bertentangan: `ALGORITHMS.md` > `PRD.md` > `DATA_MODEL.sql` > desain. Laporkan pertentangan di akhir fase; jangan diam-diam memilih.

## Stack (sudah diputuskan, jangan ganti tanpa tanya)
Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4 · Supabase (Postgres, Auth Google + email magic link) · Vitest (unit) · Playwright (E2E) · npm · PWA.

> **Next.js versi ini TIDAK sama dengan yang ada di pengetahuan Anda.** Sebelum menulis kode Next.js, baca panduan relevan di `node_modules/next/dist/docs/` dan patuhi notifikasi deprecation. Lihat juga `../mager_landing_page/AGENTS.md`.

## Aturan keras
- **Uang = integer rupiah.** Tidak ada float/`number` desimal untuk uang. Format tampilan `Rp35.000` hanya di lapisan UI.
- **Logika bisnis = fungsi murni** di `src/lib/core/` (tanpa IO, tanpa Date.now(), tanpa Math.random(); waktu dan seed diberikan sebagai argumen). UI dan DB hanya memanggilnya.
- **Statistik/klasemen diturunkan** dari data match setiap kali; jangan simpan angka klasemen sebagai kolom.
- **Tulis test dulu** untuk `src/lib/core/*` memakai test vector di `docs/ALGORITHMS.md`; kode baru boleh dianggap benar hanya jika semua vector lulus.
- **Edit skor/biaya selalu menulis `audit_log`.**
- **Tidak memproses uang** (tidak ada payment gateway, tidak ada escrow, tidak ada teks "dana aman di Magerrr"). Patungan = pencatatan manual.
- Semua teks UI **Bahasa Indonesia**. Zona waktu `Asia/Jakarta` untuk batas bulan.
- Token akses publik (`share_token`, `invite_code`) acak ≥ 128 bit, tidak bisa ditebak; endpoint tulis selalu divalidasi di server.
- Jangan menambah fitur di luar P0 tanpa diminta. P1/P2 hanya dikerjakan setelah semua P0 hijau.
- Jangan menyalin kode desain `.dc.html` mentah; implementasikan ulang dengan komponen React + token Meadow. **Periksa kontras**: beberapa tombol di file desain memakai warna teks = warna latar (tidak terbaca); jangan ditiru.

## Struktur repo (target)
```
src/app/            route Next.js (UI + route handlers)
src/components/     komponen UI (mobile-first, target sentuh >= 44px)
src/lib/core/       logika murni + *.test.ts   <- fokus utama
src/lib/db/         akses Supabase (satu-satunya tempat yang tahu skema)
src/lib/format.ts   Rp, tanggal, nama
supabase/migrations/  SQL (dari docs/DATA_MODEL.sql)
tests/e2e/          Playwright
docs/               PRD, ALGORITHMS, DATA_MODEL.sql, BUILD_PLAN, design/
```

## Perintah (harus ada & hijau sebelum setiap fase ditutup)
```
npm run dev | build | lint | typecheck | test | test:e2e
```
Fase selesai hanya jika: `lint`, `typecheck`, `test` (dan `test:e2e` bila fase memuatnya) lulus, dan acceptance criteria fase terpenuhi. Laporkan hasil nyata, termasuk yang gagal.

## Kapan berhenti dan bertanya
- Butuh kredensial/project Supabase nyata atau OAuth Google (minta pengguna menyediakan; jangan mengarang atau menaruh secret di repo).
- Dua dokumen bertentangan dan dampaknya mengubah perilaku yang terlihat pengguna.
- Perlu menghapus/menimpa data atau file di luar `mager_apps/`.
Di luar itu: ambil keputusan masuk akal, catat di `docs/DECISIONS.md` (satu baris: tanggal, keputusan, alasan), lanjut.

## Konteks proyek tetangga
- `../mager_landing_page` — landing page (Next.js). Jangan diubah dari repo ini.
- `../rapor-main-ai` — pipeline AI analisis video (nama lama: Rally). **Di luar MVP** (lihat PRD 14.1).
