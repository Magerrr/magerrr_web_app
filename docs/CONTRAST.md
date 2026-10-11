# Checklist kontras & aksesibilitas (Fase 8)

Diperiksa otomatis — jangan isi manual:
- `src/lib/contrast.test.ts` menghitung rasio WCAG dari `docs/design/project/ds/meadow/tokens.json` untuk setiap pasangan warna di bawah (`npm test`).
- `tests/e2e/quality.spec.ts` menjalankan axe-core (WCAG 2.1 A/AA, termasuk `color-contrast`) di 22 tampilan, memeriksa target sentuh ≥ 44×44 px dan tidak ada scroll samping di lebar 360 dan 430 px (`npm run test:e2e`).

## Teks (minimal 4.5:1)

| Teks | Latar | Rasio | Dipakai di |
|---|---|---|---|
| ink-black `#2c2e2a` | cream-paper `#f5f1e4` | 12.14 | teks halaman |
| ink-black | pure-white `#ffffff` | 13.71 | kartu, input, tombol sekunder |
| ink-black | sandstone `#e0dbce` | 9.92 | tombol nonaktif, badge "Belum bayar" |
| ink-black | fresh-grass `#8ed462` | 7.67 | tombol aksen, baris "kamu", kartu juara, badge "Lunas" |
| ink-black | sunshine-pop `#f5e211` | 10.30 | banner offline |
| cream-paper | ink-black | 12.14 | tombol utama, kartu progres patungan, podium |
| cream-paper | pure-ink `#000000` | 18.58 | avatar, blok podium 2–3 |

## Non-teks (minimal 3:1)

| Elemen | Latar | Rasio |
|---|---|---|
| border kontrol ink-black | cream-paper / pure-white | 12.14 / 13.71 |
| cincin lunas fresh-grass | pure-ink | 11.74 |

## Dekoratif (tidak membawa makna sendiri)

- Outline **coral-pop** (2.7:1 di atas putih) pada pesan error dan badge "Menunggu konfirmasi": maknanya selalu ada di teks ink-black di dalamnya (aturan Meadow: outline coral selalu berpasangan dengan teks ink-black).
- **hairline-mist** hanya pemisah baris, bukan satu-satunya batas kontrol.
- **stone-gray** (3.43:1) tidak dipakai untuk teks; Meadow hanya mengizinkannya untuk teks ≥ 24px.

## Lainnya yang diperiksa

- Fokus keyboard: outline 2px ink-black di semua elemen (`:focus-visible`, `globals.css`); pill pilihan memakai `has-focus-visible`.
- Nama aksesibel tombol memuat teks yang terlihat (WCAG 2.5.3), mis. tombol skor "Tambah poin p1 / p2 …", "−1 kurangi poin …".
- Tautan di dalam kalimat dikecualikan dari aturan 44px (WCAG 2.5.8); tautan mandiri memakai `textLinkClass` (tinggi 44px).
- `lang="id"`, satu `h1` per halaman, label untuk setiap input, `role="alert"` untuk error dan `role="status"` untuk info.
