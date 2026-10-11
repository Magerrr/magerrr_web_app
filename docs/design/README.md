# Desain — peta layar → fitur MVP

Sumber: artifact Claude Design **"Magerrr — Mabar Badminton App"** (https://claude.ai/artifact/DJ9HEeVUaExk47LXowXDkt), 48 layar mobile 390×844, design system **Meadow**.
Salinan lokal layar yang relevan ada di `docs/design/project/*.dc.html`; token di `docs/design/project/ds/meadow/` (`tokens.json`, `README.md`). Jika file tidak ada di sini, bacalah dari artifact lewat tool Artifact (`action: read`, `path: project/<Nama>.dc.html`).

Format `.dc.html` = markup + script `DCLogic` yang hanya contoh perilaku. **Implementasikan ulang** sebagai komponen React; jangan menyalin.

## Peta layar

| Layar desain | Fitur PRD | Prioritas MVP |
|---|---|---|
| `Login.dc.html` 02 · Masuk / Tamu | G1, G3 (Google / email; masuk sebagai tamu lewat invite) | P0 |
| `Home.dc.html` 04 · Beranda | Daftar sesi grup, tombol Buat Mabar. **Sederhanakan:** hanya sesi + akses leaderboard; tanpa "cari mabar publik", feed, Kiko | P0 (versi sederhana) |
| `Create.dc.html` 07 · Buat Mabar | S1, S2, G2, P1. Format Ganda/Tunggal, jumlah pemain, grade, kok, sistem main, estimasi patungan | P0 (lihat catatan) |
| `Session.dc.html` 07b · Sesi Main: Rotasi & Skor | SC1–SC4, SC9, SC10, P1 (+kok) | **P0, layar inti** |
| `SplitBill.dc.html` 16 · Patungan (Host) | P1–P8 | P0 |
| `Leaderboard.dc.html` 23 · Leaderboard | L1–L5, L10 | P0 (lihat catatan) |
| `Profile.dc.html` 11 · Profil & Statistik | X2 | P1 |
| (tidak ada desain) | Recap sesi (R1–R5), edit/riwayat match, pengaturan grup & aturan skor, info rekening host, halaman tagihan publik | **Perlu dirancang** (ikuti gaya Meadow) |

Layar lain (Booking, Wallet, Marketplace/Lapak, Feed, Kiko/maskot, Poin Ikan, Turnamen, Rapor Main, Komunitas, Chat) **di luar MVP** — jangan diimplementasikan.

> **Pasca-MVP (2026-10-10, atas permintaan pengguna):** `Kiko.dc.html` + `MascotHome.dc.html` + `MascotSheet.dc.html` → `/g/[id]/kiko` (dan kartu Kiko di profil); `Bracket.dc.html` + `CreateTournament.dc.html` → `/g/[id]/sesi/[sid]/turnamen` dan `/s/[token]/turnamen` (sistem gugur, round robin, grup + gugur); `Chat.dc.html` → `/g/[id]/obrolan` (teks saja). Bagian desain yang tidak dibuat dicatat di `docs/DECISIONS.md`. Layar lain di atas tetap di luar cakupan.

## Perbedaan desain vs PRD (keputusan)

1. **Escrow / "Dana aman di Magerrr"** (SplitBill) — dibuang. MVP hanya mencatat; tidak ada uang lewat aplikasi. Hapus kartu itu.
2. **Leaderboard desain** punya tab *Streak / Paling Sering / Juara* untuk komunitas. PRD butuh **Klasemen** berbasis menang-kalah. Tambahkan tab **Klasemen** sebagai tab pertama (default); tab *Streak* dan *Paling Sering* boleh dipertahankan (P1) karena murah dihitung dari data yang sama. *Juara* (trofi turnamen) di luar MVP → ganti dengan **Juara Musim** (P1) atau sembunyikan.
3. **Grade A–D** di desain (Create, Session) → dipakai: kolom `members.grade` (opsional, diatur admin), jadi `rating` kocok pasangan (ALGORITHMS §4.2). Filter "grade yang boleh gabung" pada Create **tidak** untuk MVP (komunitas tertutup).
4. **Sistem main** di Create: *Rotasi*, *Fix pasangan*, *Round robin*. PRD menambah **Kocok** (default) → mapping `play_mode`: `kocok`, `rotasi`, `fix_pasangan`, `round_robin`. P0: `kocok`, `rotasi`.
5. **Format "Campuran"** di Create → tidak untuk MVP (butuh data gender); sembunyikan.
6. **Booking GOR / harga lapangan otomatis** di Create → ganti input manual: nama GOR (teks), jumlah lapangan, durasi, biaya sewa (masuk sebagai `expense`).
7. **Kok per slop** (Session: "Kok terpakai X dari 12", tombol "+ Kok") → pertahankan (P1); hitung dengan `shuttleCost` (ALGORITHMS §5.5), otomatis menjadi expense patungan saat sesi ditutup.
8. **Aturan skor**: desain tetap "21 poin · 1 game". PRD: preset BWF 21 / 15 / 11 / kustom, deuce & cap. Chip aturan di Session menampilkan preset aktif. Tombol +1 / −1 tetap (SC2); ditambah *undo*.
9. **Game selesai otomatis** memakai `gameWinner`, bukan hanya `>= 21` seperti di prototipe (prototipe salah di deuce).
10. **"Ingatkan" di SplitBill** → pada MVP membuka tautan WhatsApp (`https://wa.me/?text=<teks tagihan>`), bukan push notifikasi.

## Token Meadow (diverifikasi dari `project/ds/meadow/tokens.json`; baca juga `README.md` di folder itu)
| Token | Nilai | Pakai untuk |
|---|---|---|
| `cream-paper` (surface-0) | `#f5f1e4` | latar halaman |
| `pure-white` (surface-1) | `#ffffff` | kartu terangkat, nav |
| `sandstone` (surface-2) | `#e0dbce` | permukaan cekung, tombol nonaktif |
| `ink-black` | `#2c2e2a` | semua teks, garis, isi tombol utama |
| `fresh-grass` | `#8ed462` | aksen utama (isi tombol aksi); teks di atasnya `ink-black` |
| `sky-pop` / `coral-pop` / `sunshine-pop` | `#2ba0ff` / `#ff705d` / `#f5e211` | aksen kecil; maksimal satu per komponen; **coral bukan warna CTA utama**; selalu pasangkan outline coral dengan teks ink-black |
| `stone-gray` | `#80827f` | teks redup hanya untuk ≥ 24px; di bawah itu pakai `ink-black` |
| `hairline-mist` | `#d5d5d4` | pemisah dekoratif; jangan jadi satu-satunya batas kontrol |
| `pure-ink` | `#000000` | ikon / kontras maksimum |
Font: Inter (400/500), huruf kecil kalimat biasa (sentence case), **tanpa emoji di UI**. Meadow **tanpa shadow**: pisahkan lapisan dengan border 1px `ink-black` dan tingkat surface. Pill (radius 50) untuk tombol/chip, kartu radius 20, target sentuh ≥ 44px. Buat sebagai CSS variables / Tailwind theme, bukan hex tersebar di komponen.

## Cacat desain yang jangan ditiru
- Tombol dengan teks `#2C2E2A` di atas latar `#2C2E2A` (mis. "+ Kok", tombol "+" di Create): teks tak terbaca. Pakai `#F5F1E4` di atas tinta.
- Teks 11–12px pada elemen penting: minimal 12px, tombol 14px+.
- Prototipe memakai `#2C2E2A` untuk hampir semua teks sekunder; boleh dibuat lebih lembut tapi kontras ≥ 4.5:1.
