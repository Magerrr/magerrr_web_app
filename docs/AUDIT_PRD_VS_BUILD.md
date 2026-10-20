# Audit PRD vs Build & Prioritas P1/P2 (MEO-5)

Tanggal: 2026-10-20 · Penyusun: Product Analyst · Metode: baca `docs/PRD.md` §6, `BUILD_PLAN.md`, `DECISIONS.md`, lalu cek keberadaan kode (`src/`, `supabase/migrations/0001–0023`, `tests/e2e/`). **Tidak menjalankan aplikasi/test**; "Ada" = kode + (bila disebut) e2e spec ditemukan, bukan diverifikasi perilakunya.

## 1. Ringkasan
- Semua P0 dan hampir seluruh P1 PRD §6 sudah terbangun; Fase 9 BUILD_PLAN praktis selesai, ditambah banyak fitur di luar PRD (Kiko, turnamen, obrolan, grup publik, momen, wasit, pencatat per lapangan, posisi kok).
- Sisa celah nyata kecil. Risiko produk bergeser dari "fitur kurang" ke **scope creep** dan **validasi pemakaian** (metrik PRD §4 belum punya instrumentasi, lihat 4).
- Dokumen PRD/BUILD_PLAN tertinggal dari build: banyak keputusan hanya di DECISIONS.md.

## 2. Status per requirement P1/P2

| ID | Requirement | Prio | Status | Catatan |
|---|---|---|---|---|
| G6 | Klaim profil | P1 | Ada | `/klaim/[token]`, `claim.spec.ts` |
| G7 | Multi-grup | P2 | Ada | `/grup`, `/jelajah` |
| G8 | Foto/avatar | P2 | Ada | profil + logo/sampul grup |
| S3 | RSVP | P1 | Ada | `rsvp.tsx`, API rsvp, `rsvp.spec.ts` |
| S5 | Sesi berulang | P1 | **Sebagian** | Hanya "Duplikat untuk minggu depan" (manual). Belum template/jadwal otomatis mingguan |
| S6 | Pengingat otomatis | P2 | Belum | Tidak ada kode; butuh kanal WA/push |
| SC5 | Ganti sisi, game/match point | P1 | Ada | `scoring.ts`, `live-court.tsx` |
| SC8 | Live scoreboard | P1 | Ada | `/s/[token]/skor`, `/layar`, refresh 3 dtk (polling), bukan realtime |
| SC9 | Antrian giliran | P1 | Ada | `queue.ts`, `round-planner` |
| SC10c/d | fix_pasangan / round_robin | P1/P2 | Ada | `fixed.ts`, `roundrobin.ts` |
| L6 | Streak & form | P1 | Ada | leaderboard, profil |
| L7 | Head-to-head | P1 | Ada | profil anggota (`player.ts`) |
| L8 | Min. main masuk peringkat | P1 | Ada | pengaturan grup |
| L9 | Musim | P1 | Ada | `/musim`, `seasons.spec.ts` |
| L10 | Statistik pasangan | P1 | Ada | `recap.ts`, profil |
| L11 | Leaderboard tunggal/gabungan | P2 | Perlu cek | Ada tab jenis di leaderboard; belum diverifikasi mencakup "Gabungan" |
| P9 | Kalah traktir | P2 | Belum | |
| P10 | Saldo utang/piutang lintas sesi | P1 | Ada | `/saldo`, `balance.ts` |
| P11 | Pengingat tagihan | P2 | Belum | satu paket dengan S6 |
| P12 | Bukti transfer | P2 | Belum | |
| R6 | Recap musim/bulanan | P1 | Ada | `period-recap.ts`, `/recap` |
| R7 | Foto/momen di recap | P2 | Sebagian | Momen grup ada (`/momen`), belum tertaut ke recap sesi |
| X2 | Profil pemain | P1 | Ada | `/g/[id]/anggota/[memberId]`, `/profil`; tagihan di profil belum diverifikasi |
| X3 | Ekspor CSV | P2 | Belum | tidak ada `text/csv` |
| X5 | Mode gelap | P2 | Belum | |
| 14.1 | Rapor Main AI | pasca | Belum | sengaja ditunda |

## 3. Prioritas yang direkomendasikan (sisa pekerjaan + penyempurnaan fitur P1 yang disebut)

Kriteria: nilai bagi komunitas mabar (frekuensi dipakai tiap sesi, mengurangi kerja host/admin, mendorong pemain non-host membuka link) ÷ usaha, dan tidak melanggar aturan keras (tanpa memproses uang).

| # | Item | Nilai | Usaha | Alasan |
|---|---|---|---|---|
| 1 | **Validasi & instrumentasi metrik PRD §4** (event dasar: sesi dengan skor, patungan, recap dibagikan, pembuka link non-host) | Tinggi | S | Tanpa ini tidak ada dasar memprioritaskan apa pun di bawahnya; PRD §9 sudah mewajibkan analytics dasar |
| 2 | **S5 lengkap: sesi mingguan otomatis** (template jadwal → sesi Rencana dibuat otomatis, peserta default dari sesi terakhir, RSVP terbuka) | Tinggi | M | Mabar bersifat mingguan; menghilangkan langkah manual host tiap minggu dan menyalakan RSVP lebih awal. Duplikat manual sudah menutup 70% kebutuhan, jadi bukan blocker |
| 3 | **RSVP: tampilan ringkas "siapa ikut" di kartu sesi/beranda + batas kuota lapangan** (cek dulu apa yang sudah ada) | Tinggi | S | Host perlu tahu cukup tidaknya 4 pemain/lapangan sebelum hari H |
| 4 | **Live scoreboard: bagikan link ke WA dari sesi + indikator "terakhir diperbarui"/offline** | Sedang | S | Polling 3 dtk sudah cukup untuk skala komunitas; realtime (Supabase Realtime) tidak perlu sekarang |
| 5 | **Profil pemain: bagian "tagihan saya" + ringkasan musim berjalan** | Sedang | S | Mendorong pemain non-host kembali membuka aplikasi (metrik ≥70%) |
| 6 | **Musim: otomatis tutup bulanan & umumkan juara (recap musim bagikan ke WA)** | Sedang | S | Fitur dasar ada; yang kurang adalah "momen berbagi" yang menarik retensi |
| 7 | **X3 Ekspor CSV** (sesi, match, tagihan) | Sedang-rendah | S | Murah; berguna untuk bendahara/admin yang rekap di spreadsheet |
| 8 | **S6/P11 Pengingat via tautan WA** (tombol "Ingatkan" membuka `wa.me` dengan teks siap kirim, tanpa API berbayar) | Sedang | S | Mendapat 80% manfaat pengingat tanpa integrasi WA Business |
| 9 | R7 tautkan momen ke recap sesi | Rendah-sedang | S | Meningkatkan daya bagi recap |
| 10 | X5 mode gelap | Rendah | M | Token Meadow terikat kontras; risiko regresi kontras tinggi |
| 11 | P9 kalah traktir, P12 bukti transfer | Rendah | M | P12 mendekati penanganan uang/privasi, tunda; P9 gimmick |
| Tunda | Pengingat otomatis server (WA API/push), Rapor Main AI, Elo | - | L | Biaya/regulasi tinggi, tunggu data pemakaian |

## 4. Temuan & risiko
1. **Scope creep**: Kiko, turnamen, obrolan, grup publik, momen sudah dibangun di luar PRD. Disarankan freeze fitur baru sampai item 1 menunjukkan pemakaian nyata.
2. **Dokumen drift**: PRD §6 dan BUILD_PLAN Fase 9 belum menandai status "selesai". Usulan: tambah kolom status di PRD §6 dari tabel §2.
3. **Pertentangan dokumen**: BUILD_PLAN "sengaja tidak dikerjakan" (maskot, turnamen, chat) vs build; sudah dicatat DECISIONS 2026-10-10 atas permintaan pengguna, perlu diperbarui di PRD §4 Non-Goals.
4. **Metrik tidak terukur**: tidak ditemukan kode analytics untuk metrik §4.
5. **Privasi**: grup publik (`/jelajah`) + momen foto + obrolan menambah permukaan data pribadi; perlu tinjauan kebijakan privasi sebelum rilis luas.

## 5. Batasan audit
Keberadaan kode tidak sama dengan lulus acceptance criteria; belum menjalankan `lint/typecheck/test/test:e2e`. Working tree saat audit memiliki banyak perubahan belum di-commit (dikerjakan run lain, MEO-4). Item "Perlu cek": L11 Gabungan, tagihan di profil, cakupan RSVP.
