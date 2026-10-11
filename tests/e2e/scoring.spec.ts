import { expect, test, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

type Setup = { groupId: string; sessionId: string; ids: Record<string, string>; host: string; inviteCode: string };

/** Host login, grup, 7 tamu (p1–p7), sesi berjalan dengan 8 peserta. */
async function runningSession(page: Page, session: Record<string, unknown>): Promise<Setup> {
  await signInFast(page, uniqueEmail("host"));
  const group = await createGroupViaApi(page, "Grup Skor");
  const ids: Record<string, string> = {};
  for (const name of ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]) {
    ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;
  }
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).eq("role", "admin").single();
  const host = hostRow!.id;
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: {
      date: "2026-10-09",
      time: "19:00",
      durationMin: 120,
      venue: "GOR Uji",
      courtCount: 2,
      playMode: "kocok",
      rules: null,
      matchGames: null,
      note: null,
      attendeeIds: [host, ...Object.values(ids)],
      costs: { courtPerHour: null, shuttle: null },
      ...session,
    },
  });
  expect(created.status()).toBe(201);
  const sessionId = (await created.json()).id;
  expect((await page.request.post(`/api/groups/${group.id}/sessions/${sessionId}/status`, { data: { status: "running" } })).status()).toBe(200);
  return { groupId: group.id, sessionId, ids, host, inviteCode: group.inviteCode };
}

async function runningMatches(sessionId: string) {
  const { data } = await admin()
    .from("matches")
    .select("id, court_no, match_players(side, member_id)")
    .eq("session_id", sessionId)
    .eq("status", "running")
    .order("court_no");
  return data!.map((m) => ({
    id: m.id,
    courtNo: m.court_no,
    A: m.match_players.filter((p) => p.side === "A").map((p) => p.member_id).sort(),
    B: m.match_players.filter((p) => p.side === "B").map((p) => p.member_id).sort(),
  }));
}

test("kocok 3 ronde: deuce 20–20 → 22–20, 30–29 menutup game, undo, edit & void tercatat di audit_log", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const s = await runningSession(page, {});
  const api = `/api/groups/${s.groupId}/sessions/${s.sessionId}`;
  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}/main`);

  const playRound = async () => {
    await page.getByRole("button", { name: "Kocok ronde" }).click();
    await expect(page.getByTestId("proposal-court-1")).toBeVisible();
    await expect(page.getByTestId("proposal-court-2")).toBeVisible();
    await page.getByRole("button", { name: "Mulai main" }).click();
    await expect(page.getByTestId("court-1").getByTestId("score-A")).toHaveText("0");
    const running = await runningMatches(s.sessionId);
    expect(running).toHaveLength(2);
    // Tidak ada pemain di dua lapangan sekaligus; 8 pemain semua main.
    const players = running.flatMap((m) => [...m.A, ...m.B]);
    expect(new Set(players).size).toBe(8);
    return running;
  };

  // Ronde 1 — lapangan 1 lewat UI: 20–20 lanjut, 22–20 menutup game, undo mengurangi 1 poin.
  const round1 = await playRound();
  const court1 = page.getByTestId("court-1");
  const [plusA, plusB] = [court1.getByRole("button", { name: /^Tambah poin/ }).nth(0), court1.getByRole("button", { name: /^Tambah poin/ }).nth(1)];
  for (let i = 0; i < 20; i++) {
    await plusA.click();
    await plusB.click();
  }
  await expect(court1.getByTestId("score-A")).toHaveText("20");
  await expect(court1.getByTestId("score-B")).toHaveText("20");
  await expect(court1.getByText(/Match point|Game point/)).toHaveCount(0); // deuce: belum ada yang satu poin dari menang
  await plusA.click();
  await expect(court1.getByTestId("score-A")).toHaveText("21");
  await expect(plusA).toBeEnabled(); // 21–20 belum selesai
  await expect(plusA).toContainText("Match point");
  await plusA.click();
  await expect(court1.getByText(/menang 22–20/)).toBeVisible();
  await expect(plusB).toBeDisabled();
  await court1.getByRole("button", { name: "Undo" }).click();
  await expect(court1.getByTestId("score-A")).toHaveText("21");
  await expect(court1.getByText(/menang/)).toHaveCount(0);
  await plusA.click();
  await expect(court1.getByText(/menang 22–20/)).toBeVisible();
  await expect(court1.getByTestId("sync-status")).toHaveText("Tersimpan");
  const { data: live } = await admin().from("games").select("score_a, score_b").eq("match_id", round1[0].id);
  expect(live).toEqual([{ score_a: 22, score_b: 20 }]);
  await court1.getByRole("button", { name: "Simpan hasil" }).click();
  await expect(page.getByTestId("court-1")).toContainText("Kosong");

  // Lapangan 2: dari 29–29, tap sisi B → 29–30 menutup game.
  expect((await page.request.put(`${api}/matches/${round1[1].id}/score`, { data: { games: [{ a: 29, b: 29 }] } })).status()).toBe(200);
  await page.reload();
  const court2 = page.getByTestId("court-2");
  await court2.getByRole("button", { name: /^Tambah poin/ }).nth(1).click();
  await expect(court2.getByText(/menang 29–30/)).toBeVisible();
  await court2.getByRole("button", { name: "Simpan hasil" }).click();
  await expect(page.getByTestId("court-2")).toContainText("Kosong");

  // Ronde 2 & 3 diselesaikan lewat API.
  for (let round = 2; round <= 3; round++) {
    await page.reload();
    for (const m of await playRound()) {
      expect((await page.request.post(`${api}/matches/${m.id}/complete`, { data: { games: [{ a: 21, b: 10 }] } })).status()).toBe(200);
    }
  }
  const { data: done } = await admin().from("matches").select("id, seq, match_players(member_id)").eq("session_id", s.sessionId).eq("status", "completed").order("seq");
  expect(done).toHaveLength(6);
  const played = new Map<string, number>();
  for (const m of done!) for (const p of m.match_players) played.set(p.member_id, (played.get(p.member_id) ?? 0) + 1);
  expect([...played.values()]).toEqual(Array(8).fill(3)); // adil: semua main 3 kali

  // Edit skor match #1 → audit_log 'update' dengan sebelum/sesudah.
  await page.reload();
  await page.getByTestId("match-history").getByRole("link", { name: "Ubah skor" }).last().click();
  await expect(page.getByRole("heading", { name: "Ubah skor match #1" })).toBeVisible();
  await page.getByLabel("Game 1 sisi A").fill("21");
  await page.getByLabel("Game 1 sisi B").fill("15");
  await expect(page.getByText(/^Pemenang:/)).toBeVisible();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page).toHaveURL(/\/main$/);
  const { data: audit } = await admin().from("audit_log").select("action, before, after").eq("entity", "match").eq("entity_id", done![0].id).order("id");
  expect(audit!.map((a) => a.action)).toEqual(["create", "update"]);
  expect(audit![1].before.games).toEqual([[22, 20]]);
  expect(audit![1].after.games).toEqual([[21, 15]]);

  // Void match → tidak dihitung, tercatat.
  await page.getByTestId("match-history").getByRole("button", { name: "Batalkan" }).first().click();
  await expect(page.getByText("Dibatalkan")).toBeVisible();
  const { count } = await admin().from("audit_log").select("id", { count: "exact", head: true }).eq("entity", "match").eq("action", "void");
  expect(count).toBeGreaterThanOrEqual(1);
});

test("rotasi mereproduksi vector §4.1 (kalah keluar, antrian FIFO)", async ({ page }) => {
  const s = await runningSession(page, { playMode: "rotasi", courtCount: 1 });
  const api = `/api/groups/${s.groupId}/sessions/${s.sessionId}`;
  // Urutan awal = urutan nama: host… (0), p1 (1), …, p7 (7).
  const P = [s.host, s.ids.p1, s.ids.p2, s.ids.p3, s.ids.p4, s.ids.p5, s.ids.p6, s.ids.p7];
  const sorted = (...i: number[]) => i.map((n) => P[n]).sort();
  const queue = async () => (await admin().from("sessions").select("rotation_queue").eq("id", s.sessionId).single()).data!.rotation_queue;

  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}/main`);
  await page.getByRole("button", { name: "Mulai rotasi" }).click();
  await expect(page.getByTestId("proposal-court-1")).toContainText("p1");
  await page.getByRole("button", { name: "Mulai main" }).click();
  await expect(page.getByTestId("court-1").getByTestId("score-A")).toHaveText("0");
  let [m] = await runningMatches(s.sessionId);
  expect(m).toMatchObject({ A: sorted(0, 1), B: sorted(2, 3) });
  expect(await queue()).toEqual([P[4], P[5], P[6], P[7]]);

  // A menang lewat UI → a=[0,1] b=[4,5] queue=[6,7,2,3]
  const plusA = page.getByTestId("court-1").getByRole("button", { name: /^Tambah poin/ }).nth(0);
  for (let i = 0; i < 21; i++) await plusA.click();
  await page.getByRole("button", { name: "Selesai · rotasi" }).click();
  await expect(page.getByTestId("waiting-list").getByRole("listitem").first()).toHaveText("1p6");
  [m] = await runningMatches(s.sessionId);
  expect(m).toMatchObject({ A: sorted(0, 1), B: sorted(4, 5) });
  expect(await queue()).toEqual([P[6], P[7], P[2], P[3]]);
  await expect(page.getByTestId("waiting-list").getByRole("listitem")).toHaveText(["1p6", "2p7", "3p2", "4p3"]);

  // B menang → b=[4,5] tetap, a=[6,7], queue=[2,3,0,1]
  expect((await page.request.post(`${api}/matches/${m.id}/complete`, { data: { games: [{ a: 15, b: 21 }] } })).status()).toBe(200);
  [m] = await runningMatches(s.sessionId);
  expect(m).toMatchObject({ A: sorted(6, 7), B: sorted(4, 5) });
  expect(await queue()).toEqual([P[2], P[3], P[0], P[1]]);
});

test("input skor manual best of 3, validasi skor, dan izin", async ({ page, browser, baseURL }) => {
  const s = await runningSession(page, { matchGames: 3 });
  const api = `/api/groups/${s.groupId}/sessions/${s.sessionId}`;

  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}/main`);
  await page.getByRole("link", { name: "Catat manual" }).click();
  await page.getByLabel("Pemain A1").selectOption({ label: "p1" });
  await page.getByLabel("Pemain A2").selectOption({ label: "p2" });
  await page.getByLabel("Pemain B1").selectOption({ label: "p3" });
  await page.getByLabel("Pemain B2").selectOption({ label: "p4" });
  await page.getByLabel("Game 1 sisi A").fill("25");
  await page.getByLabel("Game 1 sisi B").fill("10");
  await expect(page.getByText("Skor game 1 (25–10) tidak mungkin dengan aturan ini.")).toBeVisible();
  for (const [i, a, b] of [[1, 21, 15], [2, 18, 21], [3, 21, 17]] as const) {
    await page.getByLabel(`Game ${i} sisi A`).fill(String(a));
    await page.getByLabel(`Game ${i} sisi B`).fill(String(b));
  }
  await expect(page.getByText("Pemenang: p1 / p2.")).toBeVisible();
  await page.getByRole("button", { name: "Simpan match" }).click();
  await expect(page).toHaveURL(/\/main$/);
  await expect(page.getByTestId("match-history")).toContainText("21  18  21");
  const { data: saved } = await admin().from("matches").select("status, winner, games(score_a, score_b)").eq("session_id", s.sessionId).single();
  expect(saved).toMatchObject({ status: "completed", winner: "A" });
  expect(saved!.games).toHaveLength(3);

  // Server menolak skor mustahil, match belum selesai, dan pemain dobel.
  const post = (body: Record<string, unknown>) =>
    page.request.post(`${api}/matches`, { data: { kind: "singles", courtNo: null, A: [s.ids.p5], B: [s.ids.p6], ...body } });
  const impossible = await post({ games: [{ a: 25, b: 10 }] });
  expect(impossible.status()).toBe(422);
  expect((await impossible.json()).error).toBe("Skor game 1 (25–10) tidak mungkin dengan aturan ini.");
  expect((await post({ games: [{ a: 21, b: 15 }] })).status()).toBe(422);
  expect((await post({ B: [s.ids.p5], games: [{ a: 21, b: 15 }, { a: 21, b: 15 }] })).status()).toBe(422);

  // Bukan admin → 403.
  const guestCtx = await browser.newContext({ baseURL });
  expect((await guestCtx.request.post(`/api/join/${s.inviteCode}`, { data: { displayName: "Penonton" } })).status()).toBe(201);
  expect((await guestCtx.request.post(`${api}/plan`, { data: { kind: "doubles", seed: 1 } })).status()).toBe(403);
  expect((await guestCtx.request.post(`${api}/matches`, { data: { kind: "singles", courtNo: null, A: [s.ids.p5], B: [s.ids.p6], games: [{ a: 21, b: 1 }, { a: 21, b: 1 }] } })).status()).toBe(403);
  await guestCtx.close();
});

test("koneksi putus: skor tetap di layar, status 'belum tersinkron', lalu tersinkron otomatis", async ({ page, context }) => {
  const s = await runningSession(page, { courtCount: 1 });
  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}/main`);
  await page.getByRole("button", { name: "Kocok ronde" }).click();
  await page.getByRole("button", { name: "Mulai main" }).click();
  const court = page.getByTestId("court-1");
  await expect(court.getByTestId("score-A")).toHaveText("0");
  const [match] = await runningMatches(s.sessionId);

  await context.setOffline(true);
  const plusA = court.getByRole("button", { name: /^Tambah poin/ }).nth(0);
  await plusA.click();
  await plusA.click();
  await expect(court.getByTestId("score-A")).toHaveText("2");
  await expect(court.getByTestId("sync-status")).toHaveText("Belum tersinkron. Mencoba lagi…");

  await context.setOffline(false);
  await expect(court.getByTestId("sync-status")).toHaveText("Tersimpan", { timeout: 10_000 });
  const { data } = await admin().from("games").select("score_a, score_b").eq("match_id", match.id);
  expect(data).toEqual([{ score_a: 2, score_b: 0 }]);
});

test("SC5: game point, ganti sisi saat game baru, dan interval 11 di game penentu", async ({ page, browser, baseURL }) => {
  const s = await runningSession(page, { matchGames: 3 });
  const api = `/api/groups/${s.groupId}/sessions/${s.sessionId}`;
  const started = await page.request.post(`${api}/matches/start`, {
    data: { matches: [{ courtNo: 1, kind: "doubles", A: [s.host, s.ids.p1], B: [s.ids.p2, s.ids.p3] }], seed: 1, queue: null },
  });
  expect(started.status()).toBe(201);
  const [matchId] = (await started.json()).ids as string[];
  expect((await page.request.put(`${api}/matches/${matchId}/score`, { data: { games: [{ a: 20, b: 15 }] } })).status()).toBe(200);

  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}/main`);
  const court = page.getByTestId("court-1");
  const [plusA, plusB] = [court.getByRole("button", { name: /^Tambah poin/ }).nth(0), court.getByRole("button", { name: /^Tambah poin/ }).nth(1)];
  await expect(plusA).toContainText("Game point"); // game 1 dari best of 3
  await expect(plusB).not.toContainText(/point/);

  // Game 1 selesai → game 2 dimulai, pemain pindah sisi.
  await plusA.click();
  await expect(court.getByText("Ganti sisi lapangan: game 2 dimulai.")).toBeVisible();
  await expect(court.getByTestId("score-A")).toHaveText("0");
  await plusB.click();
  await expect(court.getByText(/Ganti sisi/)).toHaveCount(0);

  // Game penentu: skor tertinggi mencapai 11 → ganti sisi; tidak muncul lagi di poin berikutnya.
  expect((await page.request.put(`${api}/matches/${matchId}/score`, { data: { games: [{ a: 21, b: 15 }, { a: 15, b: 21 }, { a: 10, b: 8 }] } })).status()).toBe(200);
  await page.reload();
  await plusA.click();
  await expect(court.getByText("Ganti sisi lapangan: skor mencapai 11 di game penentu.")).toBeVisible();
  await plusB.click();
  await expect(court.getByText(/Ganti sisi/)).toHaveCount(0);

  // Match point terlihat di papan skor publik.
  expect((await page.request.put(`${api}/matches/${matchId}/score`, { data: { games: [{ a: 21, b: 15 }, { a: 15, b: 21 }, { a: 20, b: 18 }] } })).status()).toBe(200);
  const { data: token } = await admin().from("sessions").select("share_token").eq("id", s.sessionId).single();
  const visitor = await (await browser.newContext({ baseURL })).newPage();
  await visitor.goto(`/s/${token!.share_token}/skor`);
  await expect(visitor.getByTestId("live-court-1")).toContainText("Match point");
  await visitor.context().close();
});
