# BUILD_PLAN — urutan kerja untuk Claude Code

Kerjakan **berurutan**. Tiap fase: baca bagian terkait di PRD/ALGORITHMS, tulis test, implementasi, jalankan `npm run lint && npm run typecheck && npm test` (dan E2E bila disebut), lalu laporkan. Satu fase = satu commit/PR terpisah bila repo git.
Hanya **P0** di fase ini. P1/P2 ada di Fase 9, dikerjakan jika diminta.
Keputusan kecil yang Anda ambil sendiri: catat di `docs/DECISIONS.md`.

Notasi: `[PRD: L1]` = requirement ID. `[AC]` = acceptance criteria (harus bisa diverifikasi).

---

## Fase 0 — Scaffold
**Tujuan:** proyek jalan, token desain terpasang, tooling lengkap.
- Inisialisasi Next.js 16 (App Router, TS strict, Tailwind 4) **di root `mager_apps/`** (jangan menimpa `docs/`, `CLAUDE.md`). Baca `node_modules/next/dist/docs/` dulu.
- Tambah Vitest, Playwright, ESLint, skrip `typecheck`, `test`, `test:e2e`.
- Pasang token Meadow sebagai CSS variables/Tailwind theme (`docs/design/README.md`), font Inter, tema Indonesia (`lang="id"`), manifest PWA dasar + ikon (ambil dari `../mager_landing_page/src/app/icon.svg` bila cocok).
- Siapkan Supabase CLI lokal: `supabase/migrations/0001_init.sql` = isi `docs/DATA_MODEL.sql`. `.env.example` (tanpa secret).
- **[AC]** `npm run dev` menampilkan halaman beranda kosong bergaya Meadow; `lint`, `typecheck`, `test` (1 test contoh) lulus; `npx supabase db reset` (atau SQL lint) menerapkan migrasi tanpa error.

## Fase 1 — Logika inti (tanpa UI, tanpa DB) ← risiko terbesar, kerjakan dengan teliti
**Tujuan:** semua perhitungan benar dan teruji. Implementasi di `src/lib/core/`.
- `rules.ts` (`gameWinner`, `matchWinner`, `PRESETS`) [PRD: SC3, SC4, SC6]
- `standings.ts` (+ `pairStats`, `bestPartner`) [PRD: L1–L5, L10]
- `rotation.ts` (`afterGame` mode `rotasi`) dan `kocok.ts` (`planRound`, `mulberry32`) [PRD: SC9, SC10]
- `split.ts` (`shareExpense`, `computeNet`, `applyRounding`, `settle`, `shuttleCost`) [PRD: P1–P4]
- `recap.ts` (`buildRecap`) [PRD: R1–R3]
- `format.ts` (`formatRupiah`: `35000 → "Rp35.000"`; `formatDateId`)
- **[AC]** Setiap **test vector** di `docs/ALGORITHMS.md` menjadi test dan lulus. Property test (fast-check atau loop ber-seed) untuk invarian: Σ net = 0, tiap pemain tepat sekali per ronde kocok, `|playing|+|resting|=N`. Cakupan baris `src/lib/core` ≥ 90%. Tidak ada `Math.random`/`Date.now` di `src/lib/core` (tambahkan aturan ESLint `no-restricted-properties`).

## Fase 2 — Auth, grup, anggota
[PRD: G1–G5]
- Supabase Auth: Google + email magic link. Halaman `/masuk`. Profil dibuat otomatis (trigger/handler).
- Buat grup (nama, emoji) → admin = pembuat. Pengaturan grup: aturan skor (preset + kustom), `match_games`, sistem poin klasemen, pembulatan patungan, mode main default.
- Anggota: tambah **tamu** manual (nama), edit `grade` (opsional), jadikan co-admin.
- Undangan: `/gabung/[invite_code]` → masukkan nama panggilan → membuat `members` tamu + cookie `claim_token` (httpOnly, 1 tahun). Pengunjung kembali dikenali lewat cookie. Rotasi/cabut `invite_code` oleh admin.
- Otorisasi di `src/lib/db/authz.ts`: `requireAdmin(groupId)`, `requireMember(groupId)`. Semua route handler tulis memanggilnya.
- **[AC]** E2E: daftar via email (Supabase lokal/Inbucket) → buat grup → buka tautan undangan di konteks browser lain → bergabung sebagai tamu → muncul di daftar anggota. Non-admin menerima 403 saat mengubah aturan grup (test route handler).

## Fase 3 — Buat sesi & kehadiran
[PRD: S1, S2, S4; desain `Create.dc.html`]
- Form sesi: tanggal & jam, nama GOR (teks), jumlah lapangan, durasi, mode main, aturan (default dari grup), catatan.
- Pilih peserta hadir (default = hadir sesi terakhir), tambah tamu cepat.
- Status `planned → running → finished`. Daftar sesi di beranda grup (riwayat X1).
- **[AC]** Sesi tersimpan; peserta bisa diubah; tombol "Mulai sesi" mengubah status; riwayat menampilkan sesi urut terbaru. Estimasi patungan di form (ceil ke `round_to`) sama dengan `settle`/`applyRounding` untuk vector #2 (pakai fungsi core, bukan rumus ulang).

## Fase 4 — Pertandingan & skor (layar inti)
[PRD: SC1–SC7, SC9, SC10, SC11; desain `Session.dc.html`]
- Layar sesi: lapangan aktif, skor besar, +1/−1 (≥ 44px), **undo**, game selesai otomatis (`gameWinner`), tombol "Selesai · rotasi".
- Mode `rotasi`: panggil `afterGame`. Mode `kocok`: panggil `planRound` untuk lapangan kosong (seed disimpan di sesi agar bisa direproduksi); tombol "Acak ulang" dan tukar pemain manual.
- Antrian giliran ditampilkan (siapa berikutnya).
- Input skor akhir manual (SC11) untuk match yang dicatat belakangan; mendukung tunggal/ganda, best of N.
- Edit/hapus match → **audit_log** (before/after) [SC7]. Match `void` tidak dihitung.
- Layar tetap menyala (Wake Lock API bila tersedia). Simpan setiap perubahan skor ke server segera (optimistic UI); bila gagal tampilkan status "belum tersinkron" dan coba ulang.
- **[AC]** E2E: sesi 8 pemain, 2 lapangan; mainkan 3 ronde `kocok`; tidak ada pemain di dua lapangan sekaligus; skor 20–20 lanjut ke 22–20; 30–29 menutup game; undo mengurangi 1 poin; edit skor menulis audit_log. Mode `rotasi` mereproduksi vector §4.1.

## Fase 5 — Leaderboard
[PRD: L1–L5, L10, L11 (ganda); desain `Leaderboard.dc.html`]
- Halaman `/g/[group]/leaderboard`: tab **Klasemen** (default), filter Sesi ini / Bulan ini / Musim / All-time, podium + daftar, baris "kamu" ter-highlight.
- Panggil `standings` dengan data match; tampilkan `ranked=false` di bawah.
- Statistik pasangan terbaik di profil/leaderboard.
- **[AC]** Data uji memakai vector §2 → urutan p2, p1, p3, p4; perubahan `scoring` di pengaturan grup langsung mengubah klasemen tanpa menyentuh data match.

## Fase 6 — Patungan
[PRD: P1–P8; desain `SplitBill.dc.html`; **tanpa escrow**]
- Tambah biaya dengan preset (lapangan, kok, minum, parkir) dan biaya kustom; dibayar oleh siapa; mode equal/custom/weighted; pilih peserta.
- Hitung via `shareExpense → computeNet → applyRounding → settle`; simpan ke `expense_shares` & `settlements`.
- Tampilan host: cincin x/y lunas, terkumpul vs total, daftar pemain dengan status. Host menandai Lunas; pemain tamu boleh "Saya sudah bayar" (menunggu konfirmasi, `self_reported`).
- Info pembayaran host (bank/e-wallet/QRIS) + unggah QRIS ke Storage.
- Tombol **Bagikan tagihan**: teks terstruktur siap WhatsApp (`wa.me`) + tautan halaman publik `/s/[share_token]/tagihan`.
- Halaman publik tagihan: tampil bagian tiap orang tanpa login; hanya info rekening host; tidak ada aksi tulis kecuali "Saya sudah bayar".
- **[AC]** Vector §5 #1–#6 tercermin di UI (angka sama persis). Ubah/hapus biaya menulis audit_log dan menghitung ulang settlements; status lunas yang sudah ditandai dipertahankan bila nominal tidak berubah, selain itu direset dengan peringatan.

## Fase 7 — Recap & halaman publik
[PRD: R1–R5, X1]
- Tutup sesi → `buildRecap` → halaman `/s/[share_token]/recap` (publik, dapat dimatikan `recap_public`).
- Kartu gambar 9:16 dan 1:1 via `next/og` (`ImageResponse`): juara, pasangan terbaik, skor tertipis, jumlah match, total per orang. Tombol unduh/bagikan (Web Share API bila ada).
- Metadata OpenGraph agar pratinjau tautan di WhatsApp menampilkan kartu.
- **[AC]** Recap untuk data vector §2 menampilkan juara p2; sesi tanpa match tidak error (kartu kosong disembunyikan); gambar PNG dikembalikan dengan ukuran 1080×1920 dan 1080×1080.

## Fase 8 — PWA, polish, QA
- PWA: manifest, service worker (cache shell + halaman terakhir), halaman offline yang jelas. Antrian tulis skor offline (P1 bila waktu terbatas; minimal tampilkan banner "offline").
- Audit mobile 360–430px, kontras ≥ 4.5:1, label ARIA, fokus keyboard, target sentuh ≥ 44px.
- Analytics event dasar (sesi dibuat, match selesai, tagihan dibagikan, recap dibagikan) — PostHog atau stub yang bisa diganti.
- Seed data demo (`npm run seed`): 1 grup, 12 anggota, 3 sesi, 25 match.
- **[AC]** Lighthouse PWA terinstal; semua E2E lulus; checklist kontras; README berisi cara menjalankan lokal.

## Fase 9 — P1/P2 (hanya jika diminta)
RSVP (S3), sesi berulang (S5), live scoreboard polling 3 dtk (SC8), kok per slop (§5.5), mode `fix_pasangan`, streak & head-to-head (L6–L7), musim (L9), profil pemain (X2), klaim profil (G6), antrian offline, integrasi Rapor Main AI (PRD 14.1).

---

## Definition of Done keseluruhan (MVP)
Semua AC Fase 0–8 terpenuhi; satu grup dapat menjalankan end-to-end (buat sesi → skor → leaderboard → patungan → recap) pada data seed tanpa error; `npm run build` sukses; tidak ada secret di repo; `docs/DECISIONS.md` mencatat keputusan yang diambil.

## Hal yang sengaja tidak dikerjakan
Payment gateway / escrow / dompet · booking GOR · marketplace · feed/komunitas publik · maskot / poin · turnamen bracket · chat · aplikasi native · analisis video AI.

> 2026-10-10: atas permintaan pengguna, **maskot Kiko**, **turnamen (sistem gugur, round robin, grup + gugur)**, dan **obrolan grup** sudah dibangun pasca-MVP (lihat `docs/DECISIONS.md`). Poin / hadiah tetap tidak dikerjakan.
