# ALGORITHMS — Spesifikasi logika & test vector

Semua fungsi di sini adalah **fungsi murni** di `src/lib/core/`. Tidak ada IO, `Date.now()`, atau `Math.random()`. Acak memakai PRNG ber-seed (`mulberry32(seed)`).
Setiap blok "Test vector" **harus** menjadi test Vitest apa adanya.

## 0. Tipe dasar

```ts
type Side = 'A' | 'B';
type Rupiah = number;            // integer >= 0 (kecuali net utang, boleh negatif)
type MemberId = string;

interface GameRules {            // dipilih per grup, bisa di-override per match
  target: number;                // 21 | 15 | 11 | kustom (>= 5)
  deuce: boolean;                // true: harus unggul 2 setelah mencapai target
  cap: number;                   // batas maksimum, hanya dipakai jika deuce=true (BWF: 30)
}
interface MatchFormat { games: number }   // jumlah game maksimum, ganjil: 1 | 3 | 5
const PRESETS = {
  bwf21:  { target: 21, deuce: true,  cap: 30 },
  poin15: { target: 15, deuce: true,  cap: 21 },
  poin11: { target: 11, deuce: true,  cap: 15 },
};
```

## 1. Aturan game & match

`gameWinner(a, b, rules): Side | null`
1. Untuk sisi `s` dengan skor `x` dan lawan `y`:
2. Jika `deuce = false`: `s` menang bila `x >= target`.
3. Jika `deuce = true`: `s` menang bila `x >= cap`, **atau** (`x >= target` **dan** `x - y >= 2`).
4. Selain itu `null` (game belum selesai). Skor negatif / non-integer → lempar `RangeError`.

`matchWinner(games: {a,b}[], rules, format): Side | null`
- Hitung kemenangan game yang `gameWinner != null`. Menang bila mencapai `ceil(format.games / 2)`.
- Game tak selesai (winner null) tidak dihitung. Jika sudah ada pemenang, game tambahan setelahnya ditolak (`RangeError`).

Test vector `gameWinner` (rules = bwf21 kecuali disebut):
| a | b | hasil |
|---|---|---|
| 21 | 19 | A |
| 21 | 20 | null |
| 22 | 20 | A |
| 20 | 20 | null |
| 29 | 29 | null |
| 30 | 29 | A |
| 29 | 30 | B |
| 21 | 0 | A |
| 0 | 0 | null |
| 15 | 14 (poin15 deuce=false → `{target:15,deuce:false,cap:15}`) | A |
| 15 | 14 (poin15 deuce=true) | null |
| 16 | 14 (poin15 deuce=true) | A |

Test vector `matchWinner` (bwf21, games=3): `[{21,15},{18,21},{21,17}]` → A · `[{21,15},{21,10}]` → A · `[{21,15},{18,21}]` → null · `[{21,15},{21,10},{5,3}]` → `RangeError`.

### 1b. Game point, match point, ganti sisi (SC5, P1)

`pointStatus(games, rules, format): { A: 'game'|'match'|null, B: … }`
- Match sudah punya pemenang → keduanya `null`.
- Game berjalan = game terakhir; bila game terakhir sudah selesai, game berjalan = game baru 0–0.
- Sisi `s` berstatus **game point** bila +1 poin untuk `s` membuat `s` memenangkan game berjalan; **match point** bila kemenangan game itu sekaligus memenangkan match. Kedua sisi bisa berstatus sekaligus (mis. 29–29 bwf21).

`sideChange(before, after, rules, format): 'game'|'interval'|null` — dipanggil untuk tiap perubahan skor `before → after`:
- `'game'`: nomor game berjalan bertambah dan match belum punya pemenang (pemain pindah sisi tiap ganti game).
- `'interval'`: nomor game sama, game berjalan adalah **game penentu** (game selesai yang dimenangkan A dan B sama-sama `ceil(games/2) − 1`), dan skor tertinggi naik dari `< mid` ke `≥ mid`, dengan `mid = ceil(target / 2)` (bwf21 → 11, poin15 → 8, poin11 → 6).
- Selain itu `null` (termasuk −1 / undo).

Test vector `pointStatus` (bwf21): `[{20,15}]` games=1 → `{A:'match',B:null}` · `[{20,15}]` games=3 → `{A:'game',B:null}` · `[{21,15},{19,20}]` games=3 → `{A:null,B:'game'}` · `[{21,15},{20,19}]` games=3 → `{A:'match',B:null}` · `[{29,29}]` games=1 → `{A:'match',B:'match'}` · `[{20,20}]` games=1 → `{A:null,B:null}` · `[{22,20}]` games=1 → `{A:null,B:null}` · `[{21,15}]` games=3 → `{A:null,B:null}` (game baru 0–0). `{target:15,deuce:false,cap:15}`, `[{14,14}]` games=1 → `{A:'match',B:'match'}`.

Test vector `sideChange` (bwf21): `[{10,5}] → [{11,5}]` games=1 → `'interval'` · games=3 → `null` · `[{21,15},{15,21},{10,8}] → [{21,15},{15,21},{11,8}]` games=3 → `'interval'` · `[{11,5}] → [{11,6}]` games=1 → `null` · `[{11,5}] → [{10,5}]` games=1 → `null` · `[{20,15}] → [{21,15},{0,0}]` games=3 → `'game'` · `[{21,15},{20,15}] → [{21,15},{21,15}]` games=3 → `null` (match selesai) · poin15 `[{7,7}] → [{8,7}]` games=1 → `'interval'`.

### 1c. Sisi lapangan untuk visual (SC8, papan layar penuh)

`courtEnds(games, rules, format): 'A'|'B'` — sisi yang berada di ujung **kiri** gambar lapangan. Asumsi: A memulai game 1 di kiri (penonton bisa menukar tampilan).
- Game acuan = game berjalan (seperti §1b); bila match sudah punya pemenang, game terakhir.
- `swaps = (nomor game acuan − 1)`, ditambah 1 bila game acuan adalah game penentu (definisi §1b) dan skor tertingginya `≥ ceil(target / 2)`.
- `swaps` genap → `'A'`, ganjil → `'B'`.

Test vector (bwf21): `[{0,0}]` games=1 → `A` · `[{10,5}]` games=1 → `A` · `[{11,5}]` games=1 → `B` · `[{11,5}]` games=3 → `A` · `[{21,15},{0,0}]` games=3 → `B` · `[{21,15}]` games=3 → `B` · `[{21,15},{15,21},{10,8}]` games=3 → `A` · `[{21,15},{15,21},{8,11}]` games=3 → `B` · `[{21,15},{21,15}]` games=3 → `B` (match selesai, game 2) · `[{21,15}]` games=1 → `B`. poin15 `[{7,7}]` → `A`, `[{8,7}]` → `B`.

### 1d. Pencatat skor per lapangan

Satu lapangan di satu sesi punya paling banyak **satu** pencatat (anggota). Di bagian ini "admin" berarti **pengurus permainan**: admin atau wasit grup (`actor.isOfficial`, MAGERRR-11). `canScore(scorer, actor)`: tanpa pencatat → hanya admin/wasit; dengan pencatat → hanya pencatat itu (admin/wasit pun harus mengambil alih dulu).

`scorerRefusal(current, next, actor, present)` → `null` (boleh) atau alasan:
- `next` bukan peserta hadir → `not_present`.
- Admin: selalu boleh (tunjuk, ganti, kosongkan).
- Pemain: `next = null` boleh bila `current` dirinya atau kosong, selain itu `not_allowed`; `next` orang lain → `not_allowed`; `next = dirinya` boleh bila `current` kosong atau dirinya, selain itu `taken`.

Test vector (h admin, b & c pemain, hadir h/b/c; wasit w berperilaku sama dengan h): admin `null→b`, `b→c`, `b→null` → null · `null→x` → `not_present` · b `null→b` → null · b `c→b` → `taken` · b `null→c` → `not_allowed` · b `c→null` → `not_allowed` · b `b→null` → null.

### 1e. Posisi kok saat servis

Pihak yang servis = sisi yang memenangkan reli terakhir (tap +1 terakhir); dicatat pencatat bersama skor live (`matches.serving`), bisa diubah manual (servis awal / koreksi). Undo mengembalikan pihak servis sebelumnya; −1 tidak mengubahnya.

`servePosition(games, server, rules, format): {side, court: 'right'|'left'} | null`
- `null` bila `server` belum diketahui atau match sudah punya pemenang.
- Game acuan = game berjalan (§1b; game selesai → game baru 0–0). `court = 'right'` bila skor `server` di game acuan genap, `'left'` bila ganjil.

Test vector (bwf21): `[{0,0}]` A → `{A, right}` · `[{1,0}]` A → `{A, left}` · `[{1,4}]` B → `{B, right}` · `[{20,19}]` B → `{B, left}` · `[{21,15},{0,0}]` A games=3 → `{A, right}` · `[{21,15}]` A games=3 → `{A, right}` · `[{21,15}]` A games=1 → `null` · server null → `null`.

## 2. Klasemen (leaderboard)

Input: daftar match `completed` (status `void`/`running` diabaikan), tiap match punya `players: {A: MemberId[], B: MemberId[]}`, `games`, `winner`, dan `sessionDate`.
Pada **ganda, kedua pemain di satu sisi dikreditkan sama**.

`standings(matches, config, period, now): Row[]`
- `config`: `{ winPoints=3, lossPoints=0, lossBonus?: {maxMargin: number, points: number}, minMatches=0 }`
- Kolom per pemain: `played, won, lost, winRate (won/played; 0 jika played=0), pointsFor, pointsAgainst, pointDiff, tablePoints`.
- `pointsFor/Against`: jumlah poin rally semua game, dari sisi pemain.
- `tablePoints = won*winPoints + lost*lossPoints + (jumlah kekalahan tipis * lossBonus.points)`; kekalahan tipis = |Σ pointsFor − Σ pointsAgainst| pada match itu ≤ `maxMargin`.
- Pemain dengan `played < minMatches` tetap tampil tapi `ranked=false` dan diletakkan setelah semua yang ranked.
- Urutan: `tablePoints` ↓, `winRate` ↓, `pointDiff` ↓, `played` ↓, lalu `memberId` ↑ (deterministik). Peringkat sama (`rank` sama) hanya bila keempat kriteria pertama identik.
- `period`: `{kind:'session', sessionId}` | `{kind:'month', year, month}` (bulan kalender `Asia/Jakarta`) | `{kind:'season', seasonId}` | `{kind:'all'}`.

Test vector (winPoints 3, lossPoints 0, tanpa bonus). Tiga match ganda, 1 game, tanpa seri:
- M1: A=[p1,p2] vs B=[p3,p4], 21–15, A menang.
- M2: A=[p1,p3] vs B=[p2,p4], 21–19, A menang.
- M3: A=[p1,p4] vs B=[p2,p3], 18–21, B menang.

| pemain | main | menang | kalah | pointsFor | pointsAgainst | pointDiff | tablePoints |
|---|---|---|---|---|---|---|---|
| p1 | 3 | 2 | 1 | 60 | 55 | +5 | 6 |
| p2 | 3 | 2 | 1 | 61 | 54 | +7 | 6 |
| p3 | 3 | 2 | 1 | 57 | 58 | −1 | 6 |
| p4 | 3 | 0 | 3 | 52 | 63 | −11 | 0 |

Urutan hasil: **p2, p1, p3, p4** (tablePoints dan winRate sama untuk p1–p3; dipisah oleh pointDiff). Invarian: Σ pointsFor = Σ pointsAgainst = 230.

Dengan `lossBonus {maxMargin: 3, points: 1}` (selisih = total poin rally dalam match): kekalahan tipis = p1 (M3, selisih 3), p2 (M2, selisih 2), p4 (M2 selisih 2, M3 selisih 3). Hasil `tablePoints`: p1=7, p2=7, p3=6, p4=2 → urutan **p2, p1, p3, p4**.

Tambahan: `minMatches=4` → semua `ranked=false` (main 3); period `session` dengan hanya M1 → p1,p2 peringkat berbagi (3 poin, selisih +6) dan urut id.

## 3. Statistik pasangan (ganda)

`pairStats(matches)` → untuk setiap pasangan terurut `(minId, maxId)` yang pernah satu sisi: `played, won, pointDiff`. Tunggal tidak dihitung. `bestPartner(memberId, minTogether=3)` = pasangan dengan `winRate` tertinggi dari yang `played >= minTogether` (tie-break `pointDiff`, lalu id).

`partnersOf(pairs, memberId)` (L10, P1) = semua partner seorang pemain tanpa ambang, urut `played` ↓, `winRate` ↓, `pointDiff` ↓, lalu id partner. Test vector (match §2): `partnersOf(pairStats([M1,M2,M3]), p1)` → p2 (1–0, +6), p3 (1–0, +2), p4 (0–1, −3) · untuk p3 → p2 (+3), p1 (+2), p4 (−6) · pemain tanpa match ganda → `[]`.

## 4. Rotasi & pembagian lapangan

Mode sistem main (`play_mode`): `kocok` (default), `rotasi` (kalah keluar), `fix_pasangan`, `round_robin`. Prioritas MVP: `kocok` P0, `rotasi` P0, `fix_pasangan` P1, `round_robin` P2.

### 4.1 `rotasi` — kalah keluar (mengikuti desain `Session.dc.html`)
State: `courts: {A: MemberId[], B: MemberId[]}[]`, `queue: MemberId[]` (FIFO bersama).
`afterGame(state, courtIdx, winner)`:
1. `winners` = sisi pemenang tetap di lapangan; `losers` = sisi kalah.
2. `q = [...queue, ...losers]` (urutan pemain kalah dipertahankan).
3. Sisi lawan baru = `q.slice(0, sideSize)`; `queue = q.slice(sideSize)`. `sideSize` = 2 (ganda) / 1 (tunggal).
4. Jika `q.length < sideSize`: lapangan menunggu (`waiting`), tidak ada error.

Test vector (ganda): `a=[0,1] b=[2,3] queue=[4,5,6,7]`, pemenang A → `a=[0,1] b=[4,5] queue=[6,7,2,3]`. Pemenang B → `b=[2,3]` tetap, `a=[4,5]`, `queue=[6,7,0,1]`.
Tunggal: `a=[0] b=[1] queue=[2,3]`, pemenang A → `a=[0] b=[2] queue=[3,1]`.
Pemain 6, dua pemain antre minimal: `a=[0,1] b=[2,3] queue=[4,5]`, A menang → `b=[4,5] queue=[2,3]`.

### 4.2 `kocok` — pasangan berganti tiap ronde
`planRound(input, seed): Court[]`
Input: `players: {id, rating, playedThisSession, roundsSinceLastPlayed}[]`, `courts: number` (lapangan kosong), `format: 'doubles'|'singles'`, `history: {partnerCount(id1,id2), opponentCount(id1,id2)}`.
1. `perMatch = 4` (ganda) / `2` (tunggal). `n = players.length`; `m = min(courts, floor(n / perMatch))`. Jika `m = 0` → kembalikan `{courts: [], resting: semua, hint: 'kurang pemain'}`; jika ganda dan `n ∈ {2,3}` sertakan `hint: 'bisa tunggal'`.
2. **Pilih pemain** (fairness dulu): urutkan `playedThisSession` ↑, lalu `roundsSinceLastPlayed` ↓, lalu hasil acak ber-seed. Ambil `m * perMatch` pertama = `playing`; sisanya `resting`.
3. **Susun tim** (hanya ganda): cari susunan `playing` → `m` lapangan × 2 tim × 2 pemain yang meminimalkan
   `cost = 10·Σ partnerCountSession + 1·Σ partnerCountAllTime + 3·Σ |ratingTimA − ratingTimB| + 1·Σ opponentCount`
   - `partnerCount*` dihitung untuk tiap pasangan dalam tim; `opponentCount` untuk tiap pasangan lawan.
   - Algoritma: untuk `m = 1` evaluasi 3 pasangan-ganda yang mungkin. Untuk `m > 1`: mulai dari permutasi ber-seed, lalu *local search* (tukar dua pemain mana pun jika menurunkan cost) hingga tak ada perbaikan atau 500 iterasi. Deterministik untuk seed yang sama.
   - Pasangan yang sama **boleh** bertemu lagi (hanya penalti). Tidak ada larangan keras.
4. `rating`: nilai grade (`A=4, B=3, C=2, D=1`) bila ada; jika tidak, `1 + 3 * winRate` dari data klasemen (0.5 → 2.5 untuk pemain baru).
5. Tunggal: pasangkan `playing` berurutan setelah diurutkan agar |selisih rating| minimal, hindari lawan yang paling sering dihadapi (cost yang sama untuk `opponentCount`).

Test vector `kocok`:
- 8 pemain, 2 lapangan → 8 `playing`, 0 `resting`, tiap pemain tepat sekali.
- 9 pemain, 2 lapangan → 8 `playing`; pemain yang `playedThisSession` terbesar (atau `roundsSinceLastPlayed` terkecil) di `resting`.
- 3 pemain, ganda → `courts=[]`, `hint='bisa tunggal'`.
- 4 pemain, `partnerCountSession(1,2)=3` dan lainnya 0 → hasil **tidak** memasangkan (1,2) bila ada alternatif (selalu ada).
- Seed sama + input sama → output identik; seed beda boleh beda.
- Property test (acak 200 input, N=2…30, M=1…5): tidak ada pemain ganda dalam satu ronde, `|playing| = m*perMatch`, `|playing|+|resting| = N`.

### 4.4 Antrian giliran (SC9, P1)
Untuk papan skor & skor langsung: siapa berikutnya dan kira-kira kapan turun. Semua fungsi murni; `now` diberikan pemanggil.
- `rotationTurns(queue, kind): number[]` — mode `rotasi`: `turn[i] = floor(i / sideSize)`. Giliran 0 masuk saat game berikutnya (di lapangan mana pun) selesai, giliran `k` saat game ke-`k+1` selesai.
- `matchMinutes(durations): number | null` — durasi khas satu match = **median** durasi match selesai sesi ini (menit, dari mulai sampai selesai) yang berada di `[3, 90]`, dibulatkan; `null` bila tidak ada. Batas bawah membuang input skor manual (durasi ≈ 0), batas atas membuang match yang lupa ditutup.
- `turnEta(elapsed, avg, turns): (number | null)[]` — `elapsed` = menit berjalan tiap lapangan rotasi yang sedang main. Tiap lapangan selesai pada `max(avg − e, 0)`, lalu tiap `avg` menit sesudahnya. Perkiraan giliran `k` = waktu selesai ke-`k` (0-based) dari gabungan semua lapangan, dibulatkan. Tanpa lapangan berjalan atau `avg = null` → semua `null`.
- `restingPriority(items)` — mode `kocok` / `fix_pasangan`: urutan istirahat sama dengan langkah pemilihan kocok (§4.2 langkah 2) tanpa unsur acak: `playedThisSession` ↑, `roundsSinceLastPlayed` ↓, lalu urutan masukan (stabil). Untuk `fix_pasangan` unitnya pasangan.

Test vector: `rotationTurns([p1..p5], doubles)` → `[0,0,1,1,2]` · `rotationTurns([p1,p2,p3], singles)` → `[0,1,2]` · `matchMinutes([12,1,14,200,16])` → 14 · `matchMinutes([10,15])` → 13 · `matchMinutes([1,2])` → null · `turnEta([5,12], 15, 4)` → `[3,10,18,25]` · `turnEta([20], 15, 2)` → `[0,15]` · `turnEta([], 15, 2)` → `[null,null]` · `turnEta([5], null, 1)` → `[null]` · `restingPriority([{a,2,0},{b,1,1},{c,1,3},{d,2,2}])` (id, main, ronde sejak main) → `c, b, d, a`.

## 5. Patungan (split bill)

Input: `participants: MemberId[]` (hadir), `expenses: {id, amount: Rupiah, paidBy: MemberId, mode, shares?, ...}[]`, `hostId`, `roundTo: 1|500|1000`.

### 5.1 Bagi satu biaya `shareExpense(expense, participants) → Map<MemberId, Rupiah>`
- `mode='equal'` (peserta terpilih `S`, urut `memberId` ↑): `base = floor(amount/|S|)`, `r = amount - base*|S|`; `r` orang pertama mendapat `base+1`. Σ = amount (invarian).
- `mode='custom'`: `shares` diberikan; wajib Σ = amount, kalau tidak lempar `RangeError`.
- `mode='weighted'` (mis. menit main): bagi sebanding bobot memakai **largest remainder** (sisa terbesar, tie → `memberId` ↑). Σ = amount.

### 5.2 Netto per orang `computeNet(expenses, participants) → Map<MemberId, number>`
`net = Σ share − Σ amount yang dibayar orang itu`. Positif = berutang, negatif = menalangi. **Σ net = 0** (invarian, wajib dites).

### 5.3 Pembulatan `applyRounding(net, roundTo, hostId)`
1. Untuk tiap `net > 0` (debitur): `net' = ceil(net / roundTo) * roundTo`.
2. `excess = Σ(net' − net)` atas semua debitur.
3. Kreditur menerima kelebihan: `hostId` jika `net(host) < 0`; kalau tidak, kreditur dengan |net| terbesar (tie → `memberId` ↑). Net kreditur itu dikurangi `excess` (makin negatif).
4. Σ net' = 0 (invarian).

### 5.4 Transfer minimal `settle(net) → {from, to, amount}[]`
Greedy: debitur diurutkan `net` ↓ (tie id ↑), kreditur `|net|` ↓. Ambil pasangan teratas, transfer `min(net_d, |net_c|)`, kurangi, ulangi sampai nol. Jumlah transfer ≤ (n−1). Deterministik.

Test vector:
1. **Dasar:** peserta 8 (Raka host, p2…p8). Biaya: lapangan 240000 dibayar Raka, kok 40000 dibayar Raka, `equal` ke 8, `roundTo=500`. Per orang 35000 → Raka net −245000, tiap lainnya +35000; `settle` = 7 transfer × 35000 ke Raka. Σ net = 0.
2. **Pembulatan:** lapangan 240000 + kok 25000 = 265000 (dibayar Raka), 8 peserta, `roundTo=500`. Share mentah 33125 → debitur dibulatkan 33500 (7 orang = 234500); kelebihan 2625 dikreditkan ke Raka; net Raka = −234500; 7 transfer × 33500. **Cocok dengan kalkulasi layar `Create.dc.html`** (`ceil(total/n/500)*500`).
3. **Sisa pembagian:** 100000 `equal` ke 3 → share `[33334, 33333, 33333]` mengikuti urutan id.
4. **Beberapa penalang:** A bayar lapangan 200000, B bayar kok 60000, 4 peserta (A,B,C,D) equal, `roundTo=1` → share 65000 tiap orang; net A = −135000, B = +5000, C = +65000, D = +65000. `settle` ≤ 3 transfer: C→A 65000, D→A 65000, B→A 5000.
5. **Custom tak seimbang** (Σ ≠ amount) → `RangeError`.
6. Property: untuk input acak, Σ net = 0 sebelum & sesudah rounding; semua `amount` transfer > 0 dan integer.

### 5.5 Kok per slop (P1)
`shuttleCost({pricePerSlop, used, perSlop=12}) = ceil(pricePerSlop * used / perSlop / 100) * 100`. Contoh: 40000, 4 dipakai → `13400`; 12 dipakai → 40000. Hasilnya menjadi satu `expense` biasa.

### 5.6 Saldo lintas sesi (P10, P1)
Input: semua `settlements` grup `{from, to, amount, status}` dari semua sesi. Hanya `status = 'unpaid'` yang dihitung (termasuk yang menunggu konfirmasi). Pencatatan saja: saldo bersih **tidak** mengubah atau menggabungkan transfer per sesi; pelunasan tetap ditandai per sesi.
- `memberBalances(settlements)` → per anggota yang terlibat: `owes` = Σ amount dengan `from` = dia, `owed` = Σ amount dengan `to` = dia, `net = owed − owes` (positif = akan menerima). Anggota dengan `owes = owed = 0` tidak muncul. Urut `net` ↑ (utang terbesar dulu), lalu id. Invarian: Σ net = 0.
- `counterpartBalances(settlements, memberId)` → per lawan `x`: `owes` = Σ(memberId → x), `owed` = Σ(x → memberId), `net = owed − owes` (negatif = memberId masih harus bayar ke x), `count` = jumlah transfer belum lunas. Urut |net| ↓, lalu id. Lawan dengan `net = 0` tetap muncul (impas).

Test vector: S1 p2→p1 35000 unpaid · S1 p3→p1 35000 **paid** · S2 p1→p2 20000 unpaid · S2 p3→p2 10000 unpaid.
`memberBalances` → p3 (owes 10000, owed 0, net −10000), p2 (35000, 30000, −5000), p1 (20000, 35000, +15000).
`counterpartBalances(·, p2)` → p1 (owes 35000, owed 20000, net −15000, count 2), p3 (owes 0, owed 10000, net +10000, count 1).
`counterpartBalances(·, p3)` → p2 (net −10000); transfer lunas ke p1 tidak muncul. Tanpa transfer → `[]`.

### 5.7 Iuran flat `flatNet(expenses, participants, hostId, flatFee)` (MAGERRR-14)
Cara patungan per sesi: **bagi rata** (§5.1–5.4, bawaan) atau **flat** = tiap peserta hadir membayar nominal tetap `flatFee` (integer ≥ 1) ke pengelola sesi (`hostId`, pembuat sesi). Biaya (`expenses`) tidak dibagi: pengelola menanggungnya dan memegang selisihnya.
- Bagian tiap peserta = `flatFee` (biaya tidak punya bagian per orang).
- Untuk `m ≠ hostId`: `net[m] = (m ∈ participants ? flatFee : 0) − Σ amount yang dibayar m` (penalang selain pengelola diganti pengelola).
- `net[hostId] = −Σ_{m ≠ hostId} net[m]` (pengelola boleh tidak hadir). **Σ net = 0.**
- `surplus = flatFee·|participants| − Σ amount` (positif = kelebihan iuran untuk pengelola, negatif = kekurangan ditanggung pengelola). Hanya informasi.
- Lalu pembulatan (§5.3) dan transfer minimal (§5.4) seperti biasa.

Test vector:
1. **Sama dengan rata:** peserta 8 (Raka host, p2…p8), flat 35000, lapangan 240000 + kok 40000 dibayar Raka, `roundTo=500` → tiap lainnya +35000, Raka −245000; 7 transfer × 35000 ke Raka; surplus 0.
2. **Kelebihan iuran:** peserta 6 (Raka host, p2…p6), flat 30000, lapangan 150000 dibayar Raka → tiap lainnya +30000, Raka −150000; surplus +30000.
3. **Penalang lain:** A (host), B, C, D; flat 50000; A bayar lapangan 120000, B bayar kok 60000, `roundTo=1` → net B −10000, C +50000, D +50000, A −90000; `settle`: C→A 50000, D→A 40000, D→B 10000; surplus +20000.
4. **Pengelola tidak hadir, tanpa biaya:** host H, peserta p1, p2, flat 20000 → p1 +20000, p2 +20000, H −40000; surplus +40000.
5. `flatFee` 0, negatif, atau pecahan → `RangeError`.

## 6. Recap sorotan `buildRecap(session, matches, expenses)` (P0)
Output: `{ champion, bestPair, tightestGame, biggestWin, longestWinStreak, mostPlayed, totals }`.
- `champion`: peringkat 1 `standings` dengan period=`session` (tie → seri, tampilkan semua).
- `bestPair`: pasangan dengan win rate tertinggi di sesi (`played >= 2`; jika tak ada, `null`).
- `tightestGame`: game dengan |a−b| terkecil di antara game selesai (tie → game terbaru). `biggestWin`: |a−b| terbesar.
- `longestWinStreak`: kemenangan beruntun terpanjang per pemain menurut urutan `matches.order`.
- `mostPlayed`: pemain dengan `played` terbanyak (tie → semua).
- `totals`: jumlah match, game, total biaya, per orang (dari 5.x), jumlah lunas.
Jika data kosong, field terkait `null` (UI menyembunyikan kartu), bukan error.

## 7. Recap periode `buildPeriodRecap(matches, scoring, period, previous)` (R6, P1)

Recap bulan (`period.kind = 'month'`, WIB) atau musim (`'season'`). Hanya match **ganda** `completed` di periode (sama dengan leaderboard, L11). Tidak disimpan; dihitung setiap kali.
- `totals`: jumlah match, game, sesi (sesi berbeda yang punya match), pemain.
- `champion`: baris ranked peringkat 1 klasemen periode (§2, `minMatches` grup berlaku; seri → semua); `null` bila tidak ada. `podium`: maks. 3 baris ranked teratas.
- `bestPair`: pasangan teratas `pairStats` dengan `played >= 3` (§3); `null` bila tak ada.
- `tightestGame`, `biggestWin`, `longestWinStreak`, `mostPlayed`: aturan §6, dengan urutan kronologis `sessionDate` ↑, `order` ↑, id ↑ (streak bisa menyambung antarsesi).
- `mostSessions`: pemain dengan jumlah sesi berbeda terbanyak (seri → semua, urut id).
- `rankChanges`: untuk tiap baris ranked periode ini: `previousRank` = peringkatnya di klasemen `previous` (null bila tidak ranked di sana atau `previous = null`), `change = previousRank − rank` (positif = naik), null bila `previousRank` null.
- Periode pembanding: bulan → bulan kalender sebelumnya (`previousMonth`: Jan 2027 → Des 2026); musim → musim yang mulai tepat sebelumnya menurut `startsOn` (`previousSeasonId`), null bila musim pertama.

Test vector — Oktober = match §2 (M1–M3, satu sesi s1); September: M0 A=[p4,p3] vs B=[p1,p2] 21–10, A menang (sesi s0).
- `totals` Oktober: 3 match, 3 game, 1 sesi, 4 pemain. `champion` = [p2]. `bestPair` = null (tiap pasangan 1×). `mostPlayed` = 3, [p1,p2,p3,p4]. `mostSessions` = 1, [p1,p2,p3,p4].
- `longestWinStreak` = 2, [p1, p3] (p1 M,M,K; p3 K,M,M). `tightestGame` = M2 21–19. `biggestWin` = M1 21–15.
- `rankChanges` vs September (p3, p4 peringkat 1 bersama; p1, p2 peringkat 3 bersama): p2 1 (dari 3, +2), p1 2 (dari 3, +1), p3 3 (dari 1, −2), p4 4 (dari 1, −3). Tanpa pembanding → semua `previousRank`/`change` null.
- Periode tanpa match → totals 0, semua sorotan null, `podium`/`rankChanges` kosong.
- `previousMonth({2027,1})` → `{2026,12}`; `previousSeasonId([{a,'2026-01-01'},{b,'2026-04-01'},{c,'2026-07-01'}], 'c')` → b, untuk a → null.

## 8. Sesi publik `rangeFor`, `joinBlocker`, `quotaLabel` (#15, P1)

Fungsi murni di `src/lib/core/public-sessions.ts`; waktu (`now`) selalu argumen. Batas hari memakai `Asia/Jakarta` (UTC+7), rentang setengah-terbuka `[from, to)`.
- `rangeFor(today)`: 00.00 WIB hari `now` s.d. 00.00 hari berikutnya. `week`: Senin 00.00 s.d. Senin berikutnya 00.00 WIB. `date YYYY-MM-DD`: hari itu; format/tanggal tidak valid → `null`.
- `joinBlocker(ctx, now)` → pesan atau `null`. Urutan cek: wasit → dibatalkan → selesai → sudah bergabung → `planned` dengan `startsAt < now` (lewat).
- `quotaLabel(joined, quota)`: `quota` null/≤0 → "N pemain"; sisa > 0 → "N slot tersisa"; selain itu "Penuh".

Test vector (`now` = 2026-10-21T01:00Z = Rabu 08.00 WIB):
- today → [2026-10-20T17:00Z, 2026-10-21T17:00Z); week → [2026-10-18T17:00Z, 2026-10-25T17:00Z); date 2026-10-09 → [2026-10-08T17:00Z, 2026-10-09T17:00Z); `2026-02-30` → null.
- `now` 2026-10-20T23:30Z → today mulai 2026-10-20T17:00Z. Minggu 2026-10-25T10:00Z → pekan mulai 2026-10-18T17:00Z; Senin 2026-10-25T17:00Z → pekan baru.
- `joinBlocker`: wasit → "Wasit tidak bisa bergabung sebagai pemain."; cancelled → "Sesi ini dibatalkan."; finished → "Sesi ini sudah selesai."; planned lewat → "Sesi ini sudah lewat."; sudah bergabung → "Kamu sudah bergabung di sesi ini."; planned masa depan / running → null.
- `quotaLabel(5,8)` "3 slot tersisa"; `(8,8)` dan `(9,8)` "Penuh"; `(5,null)` "5 pemain".
