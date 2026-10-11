# PRD — Magerrr (MVP)

| | |
|---|---|
| **Status** | v1.0 (siap dieksekusi Claude Code) |
| **Tanggal** | 2026-10-09 |
| **Owner** | Zed |
| **Nama produk** | Magerrr |
| **Cabang olahraga** | Badminton (mabar / main bareng komunitas) |
| **Platform target MVP** | Mobile-first web app (PWA) |
| **Login** | Google atau email (magic link) |
| **Patungan** | Pencatatan manual (tanpa proses pembayaran) |

> **Changelog v1.0:** Dokumen ini **dieksekusi oleh Claude Code (Opus), bukan developer manusia**. Ditambah: bagian "Cara memakai dokumen", stack final, dokumen pendukung (`ALGORITHMS.md` dengan test vector, `DATA_MODEL.sql`, `BUILD_PLAN.md`, `design/README.md`, `../CLAUDE.md`), Grade pemain A–D dan mode `rotasi` (dari desain) ke P0, serta pembuangan escrow dari desain Patungan. Estimasi minggu dihapus (diganti fase + acceptance criteria).
>
> **Changelog v0.4:** Semua pertanyaan produk inti terjawab. Kocok pasangan: pasangan yang sama boleh bertemu lagi (hanya diberi penalti, bukan larangan). Jumlah pemain dan lapangan **bebas/tidak tetap** per sesi. Poin klasemen default 3/0 tetapi **dapat diubah**. Biaya **bebas** (item kustom, preset hanya saran).
>
> **Changelog v0.3:** Aturan skor bisa dipilih (preset 21/15/11/kustom), format mabar = ganti-ganti pasangan (kocok pasangan jadi P0), ganda jadi tampilan utama, pengguna awal = komunitas sendiri (multi-grup P2).
>
> **Changelog v0.2:** Fokus dikunci ke **badminton**. Platform (PWA), login (Google/email), dan patungan (catatan manual) sudah dikonfirmasi. Format skor, jenis match, biaya, dan statistik disesuaikan dengan kebiasaan mabar badminton. Sisa asumsi ada di [Open Questions](#13-open-questions--asumsi-yang-perlu-dikonfirmasi).

---

## 0. Cara memakai dokumen ini (untuk Claude Code)

**Audiens:** agent coding. Tidak ada pengembang manusia yang menafsirkan yang tersirat, jadi dokumen ini menulis semuanya secara eksplisit.

| Dokumen | Isi | Kapan dibaca |
|---|---|---|
| `../CLAUDE.md` | Aturan keras, stack, perintah, kapan harus bertanya | Selalu, pertama |
| **`PRD.md`** (ini) | Apa & kenapa; requirement ber-ID dengan prioritas | Sebelum tiap fase |
| `ALGORITHMS.md` | Spesifikasi pasti + **test vector** (aturan skor, klasemen, rotasi/kocok, patungan, recap) | Sebelum menulis `src/lib/core/` |
| `DATA_MODEL.sql` | Skema Postgres/Supabase | Fase 0 & 2 |
| `BUILD_PLAN.md` | Fase 0–9, tugas, acceptance criteria | Menentukan urutan kerja |
| `design/README.md` | Peta layar desain → fitur, perbedaan desain vs PRD, token Meadow | Setiap mengerjakan UI |

**Aturan interpretasi:**
- Prioritas: **P0** wajib untuk rilis; **P1** sebaiknya; **P2** opsional. Kerjakan P0 dulu; P1/P2 hanya jika diminta.
- Kata **harus/wajib** = syarat yang diuji; **sebaiknya** = preferensi; **boleh** = opsional.
- Bila PRD diam, pilih opsi paling sederhana yang konsisten dengan prinsip di bagian 1 dan catat di `docs/DECISIONS.md`.
- Bila dokumen bertentangan: `ALGORITHMS.md` > `PRD.md` > `DATA_MODEL.sql` > desain. Laporkan, jangan diam-diam memilih.
- Nilai kebenaran logika = test vector, bukan intuisi. Jangan mengubah test vector agar kode lulus; jika vector terlihat salah, berhenti dan laporkan.

---

## 1. Ringkasan

**Magerrr** adalah aplikasi untuk komunitas/geng yang rutin main bareng (olahraga, game, nongkrong kompetitif) untuk mengelola satu siklus lengkap dalam satu tempat:

**Atur sesi main → catat skor → lihat leaderboard → patungan biaya → bagikan recap.**

Hari ini semua itu tersebar: jadwal di grup WhatsApp, skor di catatan HP/kertas, patungan dihitung manual pakai kalkulator, dan recap tidak ada. MVP ini menyatukan semuanya dengan friksi serendah mungkin — satu orang (host) bisa mengoperasikan semuanya dari HP, pemain lain cukup buka link.

## 2. Masalah

| # | Masalah | Dampak |
|---|---|---|
| 1 | Skor dicatat di kertas/chat, hilang atau diperdebatkan | Tidak ada "sumber kebenaran", sulit lihat progres |
| 2 | Tidak ada klasemen jangka panjang | Kompetisi tidak terasa, motivasi turun |
| 3 | Patungan dihitung manual, ditagih satu-satu di chat | Host capek, orang telat bayar, rawan salah hitung/ribut |
| 4 | Tidak ada dokumentasi hasil | Momen lewat begitu saja, sulit dibagikan |
| 5 | Pakai banyak aplikasi sekaligus (WA, Notes, Splitwise, Sheets) | Friksi tinggi, data terpecah |

## 3. Target Pengguna

**Persona utama — Host ("Si Pengurus")**
Orang yang biasanya booking tempat, ngumpulin orang, nalangin biaya. Ingin kerjaannya lebih ringan. Ia yang paling sering membuka aplikasi dan menginput data.

**Persona sekunder — Pemain ("Si Peserta")**
Ikut main, ingin tahu skor/peringkat dan berapa yang harus dibayar. Tidak mau install atau daftar ribet; cukup klik link dari WhatsApp.

**Ukuran grup tipikal [Asumsi]:** 8–30 orang per grup, 4–16 orang per sesi, 1–3 lapangan, durasi sewa 2–3 jam, sesi mingguan. Format mabar umum: **ganti-ganti pasangan** (rolling partner), **menang tetap main / kalah turun** (winner stays), atau pasangan tetap.

## 4. Goals, Non-Goals, & Metrik

### Goals (MVP)
1. Host bisa membuat sesi, mencatat skor, dan menutup sesi **< 2 menit setup, tanpa pelatihan**.
2. Pemain bisa melihat skor/leaderboard/tagihan **tanpa membuat akun** (lewat link).
3. Patungan satu sesi bisa dihitung dan dibagikan ke grup **< 1 menit**.
4. Setiap sesi yang selesai menghasilkan **recap yang layak di-share** ke WhatsApp/IG Story.

### Non-Goals (MVP)
- Pembayaran in-app / payment gateway / dompet (hanya *pencatatan* & pengingat; transfer di luar aplikasi).
- Booking venue / marketplace lapangan.
- Manajemen turnamen kompleks (bracket gugur, grup + knockout, seeding otomatis). *(2026-10-10: turnamen per sesi — sistem gugur, round robin, grup + gugur — dibangun pasca-MVP atas permintaan; lihat DECISIONS.)*
- Rating Elo/MMR, matchmaking otomatis.
- Chat in-app, feed sosial publik. *(2026-10-10: obrolan grup in-app dibangun pasca-MVP atas permintaan; feed publik tetap di luar — lihat DECISIONS.)*
- Aplikasi native iOS/Android (PWA dulu).

### Metrik Keberhasilan

| Metrik | Target 8 minggu setelah rilis |
|---|---|
| Grup aktif (komunitas sendiri) | 1 grup dengan ≥ 8 sesi berturut-turut |
| Anggota komunitas yang membuka aplikasi | ≥ 70% dari anggota aktif |
| Sesi selesai per bulan | ≥ 3 |
| % sesi dengan skor tercatat | ≥ 70% |
| % sesi dengan patungan dibuat | ≥ 50% |
| % sesi yang recap-nya dibagikan | ≥ 40% |
| Pemain non-host yang membuka link (per sesi) | ≥ 60% dari peserta |
| Waktu median host menyelesaikan sesi (buat → tutup) | < 5 menit di luar waktu bermain |

## 5. Konsep & Istilah

```
Grup (komunitas) ─┬─ Anggota (member / guest)
                  ├─ Musim (season, opsional)
                  └─ Sesi (1x main bareng)
                       ├─ Peserta (hadir)
                       ├─ Match (pertandingan di dalam sesi)
                       │    └─ Skor
                       ├─ Biaya (untuk patungan)
                       └─ Recap
```

- **Grup** — kumpulan orang yang rutin main (mis. "Padel Jumat Malam").
- **Sesi** — satu kali pertemuan main (tanggal, tempat, peserta).
- **Match** — satu pertandingan badminton dalam sesi: **tunggal (1v1)** atau **ganda (2v2)**, dimainkan di salah satu **lapangan** (Court 1, 2, …).
- **Game** — satu babak dalam match (match = best of 3 game, atau 1 game saja untuk mabar santai).
- **Musim** — periode klasemen (mis. bulanan); leaderboard bisa *All-time* atau per musim.

> **Keputusan:** Aplikasi **khusus badminton**. Aturan skor mengikuti peraturan BWF (rally point), tapi dapat disesuaikan per grup karena mabar sering memakai aturan longgar.

## 6. Scope MVP — Modul & Prioritas

Prioritas: **P0** = wajib ada untuk rilis, **P1** = sebaiknya ada, **P2** = kalau waktu cukup.

### 6.1 Akun & Grup

| ID | Requirement | Prioritas |
|---|---|---|
| G1 | Login host via Google atau email magic link | P0 |
| G2 | Buat grup: nama, ikon/emoji, format match default (best of 3 / 1 game / target kustom), sistem poin | P0 |
| G3 | Undang via **invite link** (dibagikan ke WhatsApp); pemain bergabung dengan memasukkan nama panggilan, **tanpa wajib akun** | P0 |
| G4 | Host menambah **pemain tamu** manual (hanya nama) | P0 |
| G5 | Peran: **Admin** (host/co-host) dan **Member**. Hanya admin yang mengubah skor & biaya | P0 |
| G6 | Member dapat "klaim" profil dengan login agar riwayatnya terikat ke akun | P1 |
| G7 | Satu orang dapat tergabung di banyak grup (MVP cukup 1 grup komunitas sendiri; arsitektur tetap multi-grup) | P2 |
| G8 | Foto/avatar pemain | P2 |
| G9 | **Grade pemain A–D** (opsional, diatur admin per anggota); dipakai sebagai `rating` pada kocok pasangan seimbang. Tanpa grade → rating dari win rate (ALGORITHMS §4.2) | P0 |

### 6.2 Sesi Main

| ID | Requirement | Prioritas |
|---|---|---|
| S1 | Buat sesi: tanggal & jam, nama GOR/lokasi (teks bebas), **jumlah lapangan**, durasi sewa, catatan | P0 |
| S2 | Pilih peserta dari anggota grup; tandai hadir/tidak hadir | P0 |
| S3 | RSVP: anggota konfirmasi "ikut / tidak" lewat link sesi | P1 |
| S4 | Status sesi: `Rencana → Berlangsung → Selesai` | P0 |
| S5 | Template sesi berulang (mingguan) / duplikat sesi sebelumnya | P1 |
| S6 | Pengingat otomatis (WA/Push) | P2 |

### 6.3 Scoring (Pencatatan Skor)

| ID | Requirement | Prioritas |
|---|---|---|
| SC1 | Tambah match: pilih jenis **Tunggal (1v1)** atau **Ganda (2v2)**, pilih pemain tiap sisi dari peserta hadir, dan **nomor lapangan** | P0 |
| SC2 | Input skor dengan **UI tap cepat**: dua tombol besar (tap sisi yang mencetak poin), tombol undo, layar tidak mati saat dipakai, bisa satu tangan | P0 |
| SC3 | **Aturan skor dapat dipilih** lewat preset: **BWF 21** (deuce di 20–20, unggul 2 poin, batas 30), **15 poin**, **11 poin**, atau **kustom** (target poin, deuce on/off, batas maksimum). Game selesai otomatis saat aturan terpenuhi | P0 |
| SC4 | **Format match** (default per grup, dapat diganti per match): **Best of 3 game**, **1 game saja** (mabar cepat), atau **jumlah game kustom** | P0 |
| SC5 | Indikator **ganti sisi** (mis. saat salah satu sisi mencapai 11 pada game penentu) dan **game point / match point** | P1 |
| SC6 | Hasil match (pemenang, skor tiap game) dihitung otomatis dan disimpan | P0 |
| SC7 | Edit / hapus match dengan **audit log** (siapa, kapan, nilai sebelum & sesudah) agar tidak diperdebatkan | P0 |
| SC8 | **Live scoreboard**: pemain lain melihat skor yang sedang berjalan lewat link (auto-refresh) | P1 |
| SC9 | **Antrian giliran**: daftar siapa sedang main per lapangan dan siapa berikutnya, supaya pemain tahu kapan turun | P1 |
| SC10 | **Kocok pasangan (rolling partner)**: dari peserta hadir, sistem membuat susunan ganda untuk ronde berikutnya dengan prioritas **(1) pemain yang paling sedikit main mendapat giliran lebih dulu, (2) pasangan yang paling jarang bermain bersama (penalti lunak: pasangan yang sama **boleh** bertemu lagi), (3) tim seimbang berdasarkan win rate**. Harus bekerja untuk **jumlah pemain dan lapangan berapa pun**: bila pemain tidak habis dibagi 4, sisanya otomatis istirahat bergiliran; bila pemain kurang dari 4, sistem menawarkan tunggal atau menunggu. Host bisa mengacak ulang atau menukar pemain manual | P0 |
| SC10b | **Mode `rotasi` — kalah keluar** (dari desain `Session`): pemenang tetap di lapangan, yang kalah masuk ujung antrian, dua pemain antrian berikutnya masuk (ALGORITHMS §4.1) | P0 |
| SC10c | Mode `fix_pasangan` (pasangan tetap, ganti lawan) | P1 |
| SC10d | Mode `round_robin` (semua ketemu semua) | P2 |
| SC11 | Skor input ulang manual (tanpa live) — ketik skor akhir tiap game setelah selesai main | P0 |
| SC12 | Statistik lanjutan (smash, unforced error, dll.) | Di luar scope |

**Aturan pencocokan hasil:** Setiap match menyimpan sisi A dan B (1–2 pemain per sisi), skor tiap game, dan pemenang. Pada ganda, **kemenangan/kekalahan dikreditkan ke kedua pemain** di sisi tersebut. Statistik individu dan pasangan diturunkan dari match — tidak diinput terpisah. Tidak ada hasil seri di badminton; jika grup memakai batas waktu, match yang tidak selesai ditandai *tidak dihitung*.

### 6.4 Leaderboard

| ID | Requirement | Prioritas |
|---|---|---|
| L1 | Klasemen per grup, urut berdasarkan **poin** | P0 |
| L2 | Sistem poin **dapat diubah kapan saja** oleh admin (karena aturan komunitas tidak menentu). **Default:** Menang = 3, Kalah = 0 (tidak ada seri). Opsi bonus: poin untuk kalah tipis (selisih ≤ N). Perubahan aturan poin **menghitung ulang** klasemen dari data match, tidak mengubah data match | P0 |
| L3 | Kolom: peringkat, nama, main (M), menang (W), kalah (L), win rate, selisih poin (+/−), poin klasemen | P0 |
| L4 | Filter periode: **Sesi ini / Bulan ini / Musim / All-time** | P0 |
| L5 | Tie-breaker berurutan: poin klasemen → win rate → selisih poin → jumlah main | P0 |
| L6 | Streak menang/kalah dan form 5 match terakhir | P1 |
| L7 | Head-to-head antar dua pemain (lawan) | P1 |
| L8 | Minimal jumlah main agar masuk peringkat (anti "menang 1x = juara") | P1 |
| L9 | Musim: buat, tutup, arsipkan, dan tampilkan juara musim | P1 |
| L10 | **Statistik pasangan (ganda):** pasangan terbaik, win rate per pasangan, "partner terbaik" tiap pemain. Karena pasangan sering berganti, ini juga dipakai oleh kocok pasangan (SC10) | P1 |
| L11 | Leaderboard **Ganda** sebagai tampilan utama (default). Leaderboard **Tunggal** terpisah, dan **Gabungan**, menyusul | P0 untuk Ganda, P2 untuk Tunggal & Gabungan |

### 6.5 Patungan (Split Bill)

| ID | Requirement | Prioritas |
|---|---|---|
| P1 | Tambah **item biaya** ke sesi dengan **preset saran badminton** (hanya pintasan; admin bebas membuat **item biaya kustom** apa pun, nama dan nominal bebas): sewa lapangan (per jam × jumlah lapangan), **shuttlecock** (per tube/slop atau per buah × jumlah dipakai), air minum/snack, parkir, lain-lain. Nominal + dibayar oleh siapa | P0 |
| P2 | Mode pembagian: **rata ke semua peserta hadir**, **pilih peserta tertentu**, atau **nominal kustom per orang**. Opsi tambahan: **bagi per jam main** (yang datang telat/pulang duluan bayar lebih sedikit) dan **tarif berbeda anggota tetap vs tamu** | P0 |
| P3 | Hitung otomatis total per orang, dengan **pembulatan** (mis. ke Rp500/Rp1.000) dan sisa pembulatan ditanggung host | P0 |
| P4 | Ringkasan "**siapa bayar ke siapa**": kalau beberapa orang menalangi, sistem menyederhanakan transfer (minimalkan jumlah transaksi) | P0 |
| P5 | Status per orang: `Belum bayar / Sudah bayar` (ditandai manual oleh host, atau oleh pemain sendiri lalu dikonfirmasi host) | P0 |
| P6 | Simpan **info pembayaran** host (nama bank/e-wallet, nomor rekening, QRIS gambar) dan tampilkan di halaman tagihan | P0 |
| P7 | **Salin / bagikan teks tagihan** siap tempel ke WhatsApp (format terstruktur + link) | P0 |
| P8 | Halaman tagihan publik per sesi (via link) — pemain melihat bagiannya tanpa login | P0 |
| P9 | Opsi: biaya shuttlecock/minum ditanggung tim yang kalah ("yang kalah traktir kok") | P2 |
| P10 | Saldo utang/piutang lintas sesi per anggota | P1 |
| P11 | Pengingat tagihan belum lunas | P2 |
| P12 | Upload bukti transfer | P2 |

> **Penting:** MVP **tidak memproses uang**. Aplikasi hanya menghitung, menampilkan, dan melacak status. Ini menghindari kebutuhan izin/lisensi pembayaran.

### 6.6 Recap

| ID | Requirement | Prioritas |
|---|---|---|
| R1 | Recap sesi otomatis saat sesi ditutup: tanggal, lokasi, peserta, daftar match & skor | P0 |
| R2 | Sorotan: **juara sesi**, **pasangan terbaik**, rally terketat (mis. menang 30–29), kemenangan terbesar, win streak terpanjang, pemain paling banyak main | P0 |
| R3 | Ringkasan patungan: total biaya, per orang, status lunas | P0 |
| R4 | **Gambar recap** (kartu rasio 9:16 & 1:1) yang bisa diunduh/dibagikan | P0 |
| R5 | Halaman recap publik via link (bisa dinonaktifkan) | P0 |
| R6 | Recap musim/bulanan (juara, top stats, perubahan peringkat) | P1 |
| R7 | Foto/momen yang diunggah ke recap | P2 |

### 6.7 Lain-lain

| ID | Requirement | Prioritas |
|---|---|---|
| X1 | Riwayat sesi per grup (list + pencarian sederhana) | P0 |
| X2 | Profil pemain: statistik personal, riwayat match, tagihan | P1 |
| X3 | Ekspor data grup (CSV) | P2 |
| X4 | Bahasa: **Indonesia** (default) | P0 |
| X5 | Mode gelap | P2 |

## 7. User Flow Inti

### Flow A — Host mengelola satu sesi (happy path)
1. Host buka grup → **Buat Sesi** (tanggal otomatis hari ini, peserta default = yang hadir terakhir).
2. Centang peserta yang hadir → **Mulai Sesi**.
3. **Tambah Match** → pilih Tunggal/Ganda, pemain tiap sisi, dan lapangan → tap sisi yang mencetak poin (game berakhir otomatis di 21 / deuce / 30) → **Simpan**. Ulangi tiap giliran.
4. Leaderboard sesi terupdate otomatis; pemain lain pantau lewat link.
5. Selesai main → **Tutup Sesi**.
6. Tambah **biaya** (mis. lapangan Rp300.000) → pilih "bagi rata" → lihat total per orang.
7. Tap **Bagikan Tagihan** → teks masuk ke WhatsApp grup.
8. Tap **Bagikan Recap** → gambar recap masuk ke WhatsApp/IG.
9. Saat orang transfer, host tandai **Sudah bayar**.

### Flow B — Pemain bergabung & melihat info
1. Terima invite link di WhatsApp → buka → masukkan nama panggilan → langsung masuk (tanpa akun).
2. Lihat sesi aktif, skor live, leaderboard.
3. Buka halaman tagihan → lihat nominal dan info rekening host → transfer → (opsional) tap "Saya sudah bayar".

### Flow C — Koreksi skor
Admin membuka match → edit skor → sistem menyimpan perubahan ke audit log → leaderboard dihitung ulang.

## 8. Model Data (Konseptual)

> Skema **final** ada di `DATA_MODEL.sql` (otoritatif). Tabel di bawah hanya ringkasan konseptual.

| Entitas | Atribut utama |
|---|---|
| `User` | id, email, nama, avatar |
| `Group` | id, nama, emoji, scoring_config (JSON), invite_code, owner_id |
| `Member` | id, group_id, user_id (nullable), display_name, role, is_guest |
| `Season` | id, group_id, nama, start, end, status |
| `Session` | id, group_id, season_id?, tanggal, lokasi, catatan, status, public_token |
| `Attendance` | session_id, member_id, rsvp_status, hadir |
| `Match` | id, session_id, urutan, tipe (singles/doubles), court_no, format, status (berjalan/selesai/tidak dihitung), winner_side, `video_url` *(opsional, pasca-MVP)*, `report_job_id` *(opsional, pasca-MVP)* |
| `Game` | id, match_id, nomor_game, skor_a, skor_b, pemenang |
| `MatchPlayer` | match_id, side (A/B), member_id |
| `PairStat` *(view/turunan)* | member_id_1, member_id_2, main, menang, selisih_poin |
| `AuditLog` | id, entity, entity_id, actor_member_id, aksi, sebelum, sesudah, waktu |
| `Expense` | id, session_id, nama, jumlah, paid_by_member_id, split_mode |
| `ExpenseShare` | expense_id, member_id, jumlah_tanggungan |
| `Settlement` | id, session_id, from_member_id, to_member_id, jumlah, status, paid_at |
| `PaymentInfo` | member_id, tipe (bank/ewallet/QRIS), label, nomor, qr_image_url |

**Prinsip data:** Leaderboard & statistik **diturunkan** dari `Match` (bukan disimpan sebagai angka mentah) agar koreksi skor selalu konsisten. Uang disimpan sebagai **integer (rupiah)**, bukan float.

## 9. Persyaratan Non-Fungsional

| Aspek | Target |
|---|---|
| **Performa** | Halaman utama < 2 dtk di jaringan 4G; input skor terasa instan (optimistic UI) |
| **Offline-tolerant** | Input skor tetap bisa dilakukan saat sinyal lemah, sinkron saat online (antrian lokal) **[P1]** |
| **Responsif** | Dirancang untuk layar 360–430 px dulu, desktop kedua |
| **Realtime** | Update skor live ke penonton dalam < 3 dtk |
| **Keamanan** | Link publik memakai token acak tidak bisa ditebak; hanya admin yang bisa menulis; validasi di server |
| **Privasi** | Nomor rekening hanya tampil di halaman tagihan sesi terkait; recap publik dapat dimatikan; hanya simpan data minimum (nama panggilan) |
| **Akurasi uang** | Semua perhitungan integer; test unit untuk pembagian, pembulatan, dan penyederhanaan utang |
| **Aksesibilitas** | Kontras cukup, target sentuh ≥ 44 px, teks dapat dibaca di bawah sinar matahari (lapangan outdoor) |
| **Observability** | Error tracking + analytics event dasar untuk metrik di Bagian 4 |

## 10. Tech Stack (final — jangan diganti tanpa bertanya)

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Frontend | **Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4**, PWA | Versi sama dengan `../mager_landing_page`. **Baca `node_modules/next/dist/docs/` sebelum menulis kode Next.js**: API bisa berbeda dari pengetahuan umum |
| Backend & DB | **Supabase** (Postgres + Auth + Storage) | Auth: Google + email magic link. Skema di `DATA_MODEL.sql`. Tulis lewat route handler/server action, bukan langsung dari klien |
| Skor live | Polling 3 dtk (P1) | Supabase Realtime bukan syarat MVP |
| Gambar recap | `next/og` (`ImageResponse`) | 1080×1920 dan 1080×1080 |
| Design system | **Meadow** (token di `design/project/ds/meadow/`) | CSS variables / Tailwind theme |
| Test | **Vitest** (logika murni, wajib), **Playwright** (alur kritis) | Test vector di `ALGORITHMS.md` |
| Paket | npm | Sama dengan landing page |
| Hosting | Vercel + Supabase cloud | Deploy bukan bagian MVP build; siapkan `.env.example` |

**Kredensial:** agent tidak boleh membuat/mengarang kunci. Pengguna menyediakan project Supabase dan OAuth Google; pengembangan lokal memakai Supabase CLI.

## 11. Rencana Kerja

Fase 0–9 beserta acceptance criteria ada di **`BUILD_PLAN.md`**. Jadwal berbasis minggu dihapus karena pelaksana adalah agent; ukuran keberhasilan adalah acceptance criteria yang lulus dan test vector yang hijau.

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Host malas input karena merasa ribet | Data kosong, produk tidak terpakai | UI input skor super cepat; default pintar; semua input opsional kecuali yang inti |
| Pemain enggan daftar/install | Adopsi rendah | Akses via link tanpa akun; PWA tanpa install |
| Sengketa skor | Konflik antar pemain | Audit log, hanya admin yang edit, riwayat perubahan terlihat |
| Aturan mabar tiap komunitas berbeda (21 vs 15 vs 11 poin, 1 game vs best of 3, deuce atau tidak) | Skor tidak cocok dengan kebiasaan grup | Default BWF, tapi target poin, jumlah game, dan deuce/cap bisa diatur per grup |
| Ganti-ganti pasangan membuat statistik pasangan kecil/tidak bermakna | Leaderboard pasangan menyesatkan | Minimal jumlah main (L8); pasangan baru masuk peringkat setelah ≥ N match |
| Input skor saat antrian padat terlalu lambat | Host berhenti mencatat | Mode input ketik-skor-akhir (SC11) sebagai alternatif live; UI dua tombol besar |
| Salah hitung patungan | Hilang kepercayaan | Integer math, unit test ketat, tampilkan rincian perhitungan |
| Sinyal buruk di lapangan | Skor hilang | Optimistic UI + antrian offline (P1) |
| Scope creep (turnamen, pembayaran) | Molor | Non-goals dikunci; fitur tambahan masuk backlog pasca-MVP |
| Kebocoran info rekening | Privasi | Tampil hanya di halaman tagihan terkait, token acak, bisa dicabut |

## 13. Open Questions & Asumsi yang Perlu Dikonfirmasi

**Sudah diputuskan:** badminton ✅ · PWA ✅ · login Google/email ✅ · patungan catatan manual ✅

Aturan skor dapat dipilih (preset 21/15/11/kustom) ✅ · Format mabar ganti-ganti pasangan ✅ · Dominan ganda, tunggal tetap didukung ✅ · Pengguna awal komunitas sendiri ✅

**Dampak keputusan:** kocok pasangan naik ke P0, leaderboard ganda jadi tampilan utama (tunggal P2), multi-grup turun ke P2, dan metrik sukses dihitung untuk satu komunitas.

**Terjawab di v0.4:**
- Kocok pasangan: pasangan yang sama **boleh** bertemu lagi → penalti lunak, bukan aturan keras.
- Jumlah pemain & lapangan **tidak tetap** → algoritma kocok dan antrian harus generik untuk N pemain / M lapangan.
- Poin klasemen default 3/0 tapi **tidak menentu** → konfigurabel, klasemen selalu dihitung ulang dari data match.
- Biaya **tidak menentu** → item biaya bebas; preset hanya saran.

**Dampak teknis:** konfigurasi aturan (skor, poin, kocok) disimpan sebagai pengaturan grup yang bisa diubah, dan klasemen/statistik selalu **diturunkan** dari data match, bukan disimpan sebagai angka mentah (sudah sesuai prinsip data di Bagian 8). Uji algoritma kocok untuk kasus N = 2…30 dan M = 1…5.

**Masih terbuka (tidak menghalangi mulai bangun):**
1. **Monetisasi** — gratis dulu, atau ada rencana (freemium, sponsor, iklan)? Tidak masuk MVP, tapi memengaruhi arsitektur.
2. **Branding** — nama produk sudah **Magerrr**; tone (santai/kompetitif) dan identitas visual masih perlu dikunci.

## 14. Backlog Pasca-MVP

- Turnamen: bracket, round-robin, fase grup + gugur *(sistem gugur, round robin, dan grup + gugur sudah ada, 2026-10-10)*
- Rating Elo/MMR & matchmaking seimbang
- Integrasi pembayaran (QRIS dinamis, e-wallet) dan pengingat otomatis via WhatsApp
- Booking venue & sinkronisasi kalender
- Badge/achievement, tantangan mingguan
- Feed komunitas & komentar pada recap
- Aplikasi native + push notification
- **Integrasi Rapor Main AI** (lihat 14.1)
- Statistik rally lanjutan (jenis pukulan, unforced error)
- Dukungan olahraga raket lain (padel, tenis meja, pickleball)
- Multi-bahasa

### 14.1 Integrasi Rapor Main AI (pasca-MVP)

Proyek terpisah `rapor-main-ai` (lokasi: `../rapor-main-ai`; sebelumnya bernama **Rally**, nama lama Magerrr) sudah memiliki pipeline analisis video badminton. Integrasi dilakukan setelah MVP stabil.

| Aspek | Rencana |
|---|---|
| **Fungsi** | Pemain atau host mengunggah video match → pipeline mendeteksi lapangan, pemain (4 slot A1 A2 \| B1 B2), pose, shuttle, pukulan, reli, dan skor → menghasilkan **rapor** per pemain (statistik, footwork, teknik, progres, saran latihan) |
| **Kaitan dengan data MVP** | `Match.video_url` dan `Match.report_job_id` (opsional) menempelkan video dan rapor ke match yang sudah ada; pemain yang terdeteksi dipetakan ke `MatchPlayer` |
| **Skor otomatis** | Skor hasil deteksi AI dapat **menyarankan** skor game (tidak menimpa input manual tanpa konfirmasi admin) |
| **API** | `POST /api/v1/jobs` (unggah video), `GET /api/v1/jobs/{id}` (status), `/report` (hasil). Dipanggil dari **backend** Magerrr, bukan dari frontend, karena memakai `X-API-Key` |
| **Recap** | Sorotan rapor (mis. kecepatan, jenis pukulan dominan) dapat ditambahkan ke recap sesi |
| **Privasi** | Video pemain bersifat data sensitif: perlu persetujuan pemain, hak hapus (`DELETE /api/v1/jobs/{id}` sudah tersedia), dan retensi terbatas |
| **Risiko** | Biaya komputasi (GPU), antrian job satu per satu, akurasi deteksi lapangan; perlu estimasi biaya sebelum dibuka ke pengguna |
| **Fitur sosial terkait** | Cari teman main / level pemain berbasis rapor (sesuai visi Magerrr), dibahas terpisah |

## 15. Definition of Done (MVP)

MVP dianggap siap rilis bila **seluruh item P0** terpenuhi, dan satu grup nyata dapat menjalankan **minimal 2 sesi berturut-turut** end-to-end (buat sesi → skor → leaderboard → patungan → recap) tanpa bantuan developer, dengan perhitungan skor dan uang tervalidasi benar oleh test otomatis.

## 16. Dokumen Pendukung & Struktur Repo

```
mager_apps/
  CLAUDE.md                  aturan agent
  docs/PRD.md                dokumen ini
  docs/ALGORITHMS.md         spesifikasi logika + test vector
  docs/DATA_MODEL.sql        skema Postgres
  docs/BUILD_PLAN.md         fase kerja
  docs/design/README.md      peta desain → fitur
  docs/design/project/       salinan layar & token Meadow
  docs/DECISIONS.md          (dibuat agent) keputusan kecil yang diambil
```
Layar desain yang belum ada dan **perlu dirancang oleh agent mengikuti Meadow**: Recap sesi, riwayat/edit match, pengaturan grup & aturan skor, info rekening host, halaman tagihan publik, anggota & undangan.
