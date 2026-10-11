# Magerrr — aplikasi mabar badminton (MVP)

Sesi main → skor → leaderboard → patungan → recap. Next.js 16 (App Router) + React 19 + Tailwind 4, Supabase (Postgres + Auth), Vitest, Playwright, PWA.

Dokumen produk & teknis ada di `docs/` (mulai dari `CLAUDE.md`): PRD, ALGORITHMS (logika + test vector), DATA_MODEL, BUILD_PLAN, DECISIONS, CONTRAST.

## Menjalankan lokal

Prasyarat: Node.js 24 (LTS) atau lebih baru, npm, dan Docker (untuk Supabase lokal).

```bash
npm install
```

```bash
npx supabase start
```

`supabase start` menerapkan semua migrasi di `supabase/migrations/`. Setelah selesai, salin `.env.example` menjadi `.env.local` lalu isi dari keluaran `npx supabase status`:

| `.env.local` | dari `supabase status` |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` (`http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` (rahasia, hanya server) |

Isi data demo (1 grup, 12 anggota, 3 sesi, 25 match, patungan). Aman diulang; hanya berjalan ke Supabase lokal:

```bash
npm run seed
```

Lalu jalankan aplikasi dan buka http://localhost:3000:

```bash
npm run dev
```

Masuk sebagai admin demo `demo@magerrr.test`: minta tautan masuk di `/masuk`, lalu buka emailnya di Mailpit (http://127.0.0.1:54324). `npm run seed` juga mencetak tautan masuk langsung.

### Catatan

- **Login Google** nonaktif sampai kredensial OAuth diisi (`[auth.external.google]` di `supabase/config.toml` + `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`). Magic link email selalu jalan.
- **Service worker / offline** hanya aktif di build produksi: `npm run build` lalu `npm start`.
- **Analytics** (sesi dibuat, match selesai, tagihan & recap dibagikan): isi `POSTHOG_KEY` (dan `POSTHOG_HOST`) untuk mengirim ke PostHog; tanpa itu event hanya dicetak di log server saat dev.
- Magerrr **tidak memproses uang**; patungan hanya pencatatan.

## Perintah

| Perintah | Isi |
|---|---|
| `npm run dev` | server pengembangan (port 3000) |
| `npm run build` / `npm start` | build & jalankan versi produksi |
| `npm run lint` | ESLint (termasuk larangan `Math.random`/`Date.now` di `src/lib/core`) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest + coverage (`src/lib/core` ≥ 90% baris) |
| `npm run test:e2e` | Playwright (build produksi di port 3100; butuh Supabase lokal berjalan) |
| `npm run db:check` | validasi migrasi tanpa Docker (PGlite) |
| `npm run db:types` | regenerasi `src/lib/db/database.types.ts` dari Supabase lokal |
| `npm run seed` | data demo di Supabase lokal |

Migrasi baru: tambah file di `supabase/migrations/`, terapkan dengan `npx supabase migration up` (atau `npx supabase db reset` untuk mulai bersih — menghapus data lokal), lalu `npm run db:types`.

## Struktur

```
src/app/            halaman & route handler (UI bahasa Indonesia)
src/components/     komponen UI Meadow (mobile-first, target sentuh >= 44px)
src/lib/core/       logika murni + test (aturan skor, klasemen, kocok/rotasi, patungan, recap)
src/lib/db/         akses Supabase (satu-satunya yang tahu skema), otorisasi
supabase/migrations SQL
tests/e2e/          Playwright
scripts/            seed, validasi migrasi
public/sw.js        service worker (cache shell + halaman terakhir, halaman offline)
```
