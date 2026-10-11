import { expect, test, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

/**
 * Grup dengan data test vector ALGORITHMS §2: host = p1, tamu p2–p4, tiga match ganda 1 game.
 * M1 [p1,p2] 21–15 [p3,p4] · M2 [p1,p3] 21–19 [p2,p4] · M3 [p1,p4] 18–21 [p2,p3]
 */
async function vectorGroup(page: Page) {
  await signInFast(page, uniqueEmail("klasemen"));
  const group = await createGroupViaApi(page, "Grup Klasemen");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).eq("role", "admin").single();
  const ids: Record<string, string> = { p1: hostRow!.id };
  for (const name of ["p2", "p3", "p4"]) {
    ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;
  }
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: {
      date: "2026-10-09",
      time: "19:00",
      durationMin: 120,
      venue: "GOR Klasemen",
      courtCount: 1,
      playMode: "kocok",
      rules: null,
      matchGames: null,
      note: null,
      attendeeIds: Object.values(ids),
      costs: { courtPerHour: null, shuttle: null },
    },
  });
  expect(created.status()).toBe(201);
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  const vector = [
    [["p1", "p2"], ["p3", "p4"], 21, 15],
    [["p1", "p3"], ["p2", "p4"], 21, 19],
    [["p1", "p4"], ["p2", "p3"], 18, 21],
  ] as const;
  for (const [A, B, a, b] of vector) {
    const saved = await page.request.post(`${api}/matches`, {
      data: { kind: "doubles", courtNo: null, A: A.map((p) => ids[p]), B: B.map((p) => ids[p]), games: [{ a, b }] },
    });
    expect(saved.status()).toBe(201);
  }
  return { groupId: group.id, sessionId, ids, inviteCode: group.inviteCode };
}

const rowMembers = (page: Page, table = "standings") =>
  page.getByTestId(table).getByTestId("standing-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-member")));

async function matchSnapshot(sessionId: string) {
  const { data } = await admin()
    .from("matches")
    .select("id, status, winner, match_players(side, member_id), games(game_no, score_a, score_b)")
    .eq("session_id", sessionId)
    .order("seq");
  return JSON.stringify(data);
}

test("klasemen vector §2: urutan p2, p1, p3, p4; ubah sistem poin menghitung ulang tanpa menyentuh match", async ({ page, browser, baseURL }) => {
  const s = await vectorGroup(page);
  const order = [s.ids.p2, s.ids.p1, s.ids.p3, s.ids.p4];

  // Dari beranda grup → leaderboard; default Bulan ini.
  await page.goto(`/g/${s.groupId}`);
  await page.getByRole("link", { name: /Leaderboard/ }).click();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bulan ini" })).toHaveAttribute("aria-current", "page");

  // All-time: urutan, kolom, highlight "kamu" (host = p1).
  await page.getByRole("link", { name: "All-time" }).click();
  await expect(page).toHaveURL(/periode=semua/);
  expect(await rowMembers(page)).toEqual(order);
  await expect(page.getByTestId("standings").getByTestId("table-points")).toHaveText(["6", "6", "6", "0"]);
  const p2Row = page.locator(`[data-member="${s.ids.p2}"]`);
  await expect(p2Row.locator("td")).toHaveText(["1", "3", "2", "1", "67%", "+7", "6"]);
  await expect(page.locator(`[data-member="${s.ids.p4}"]`).locator("td")).toHaveText(["4", "3", "0", "3", "0%", "−11", "0"]);
  const me = page.locator(`[data-member="${s.ids.p1}"]`);
  await expect(me).toHaveAttribute("aria-current", "true");
  await expect(me).toContainText("kamu");
  await expect(page.getByTestId("podium-item")).toHaveCount(3);
  await expect(page.getByTestId("podium-item").first()).toContainText("p2");

  // Sesi ini (dari halaman sesi) dan Bulan Oktober 2026 menampilkan klasemen yang sama.
  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}`);
  await page.getByRole("link", { name: "Klasemen sesi" }).click();
  await expect(page.getByRole("link", { name: "Sesi ini" })).toHaveAttribute("aria-current", "page");
  expect(await rowMembers(page)).toEqual(order);
  await page.goto(`/g/${s.groupId}/leaderboard?bulan=2026-10`);
  expect(await rowMembers(page)).toEqual(order);
  await page.goto(`/g/${s.groupId}/leaderboard?bulan=2026-09`);
  await expect(page.getByText("Belum ada match ganda yang selesai di periode ini.")).toBeVisible();
  await page.getByRole("link", { name: "Musim" }).click();
  await expect(page.getByText("Grup ini belum punya musim.")).toBeVisible();

  // Ubah sistem poin: kalah tipis (selisih ≤ 3) +1 → p1=7, p2=7, p3=6, p4=2; data match tidak berubah.
  const before = await matchSnapshot(s.sessionId);
  const patch = (scoring: Record<string, unknown>) =>
    page.request.patch(`/api/groups/${s.groupId}`, { data: { scoring: { winPoints: 3, lossPoints: 0, lossBonus: null, minMatches: 0, ...scoring } } });
  expect((await patch({ lossBonus: { maxMargin: 3, points: 1 } })).status()).toBe(200);
  await page.goto(`/g/${s.groupId}/leaderboard?periode=semua`);
  expect(await rowMembers(page)).toEqual(order);
  await expect(page.getByTestId("standings").getByTestId("table-points")).toHaveText(["7", "7", "6", "2"]);
  await expect(page.getByText("Kalah tipis (selisih total ≤ 3) +1 poin.")).toBeVisible();

  // minMatches 4 → semua belum masuk peringkat (main 3); klasemen sesi tetap memeringkat.
  expect((await patch({ minMatches: 4 })).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("standings")).toHaveCount(0);
  await expect(page.getByTestId("podium-item")).toHaveCount(0);
  expect(await rowMembers(page, "unranked")).toEqual(order);
  await page.goto(`/g/${s.groupId}/leaderboard?periode=sesi`);
  expect(await rowMembers(page)).toEqual(order);
  expect(await matchSnapshot(s.sessionId)).toBe(before);

  // Pasangan: tiap pasangan baru main bareng sekali → belum ada yang memenuhi syarat sesi (≥ 2).
  await page.getByRole("link", { name: "Pasangan" }).click();
  await expect(page).toHaveURL(/tab=pasangan/);
  await expect(page.getByTestId("my-best-partner")).toContainText("minimal 2 kali");
  await expect(page.getByText("Belum ada pasangan yang memenuhi syarat.")).toBeVisible();

  // Tamu (tanpa akun) bisa melihat leaderboard, tanpa tautan ubah sistem poin.
  const guestCtx = await browser.newContext({ baseURL });
  const guest = await guestCtx.newPage();
  await guest.goto(`/gabung/${s.inviteCode}`);
  await guest.getByLabel("Nama panggilan").fill("Penonton");
  await guest.getByRole("button", { name: /Gabung/ }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${s.groupId}$`));
  await guest.goto(`/g/${s.groupId}/leaderboard?periode=semua`);
  expect(await rowMembers(guest, "unranked")).toEqual(order);
  await expect(guest.getByRole("link", { name: "Ubah sistem poin" })).toHaveCount(0);
  await guestCtx.close();
});

test("pasangan terbaik & partner terbaik dari match berulang", async ({ page }) => {
  const s = await vectorGroup(page);
  const api = `/api/groups/${s.groupId}/sessions/${s.sessionId}`;
  // p1+p2 main bareng lagi 2x (total 3): menang 21–10, kalah 19–21.
  for (const [a, b] of [[21, 10], [19, 21]] as const) {
    const saved = await page.request.post(`${api}/matches`, {
      data: { kind: "doubles", courtNo: null, A: [s.ids.p1, s.ids.p2], B: [s.ids.p3, s.ids.p4], games: [{ a, b }] },
    });
    expect(saved.status()).toBe(201);
  }
  await page.goto(`/g/${s.groupId}/leaderboard?tab=pasangan&periode=semua`);
  await expect(page.getByTestId("pair-row")).toHaveCount(2);
  await expect(page.getByTestId("pair-row").first()).toContainText("p2");
  await expect(page.getByTestId("pair-row").first()).toContainText("3 main · 2–1 · selisih +15");
  await expect(page.getByTestId("pair-row").first()).toContainText("67%");
  await expect(page.getByTestId("my-best-partner")).toContainText("p2 · 2 menang dari 3 main (67%), selisih +15");

  // L10: partner terbaik tiap pemain (p1–p2 dan p3–p4 sama-sama 3× main bareng).
  const partnerRows = page.getByTestId("best-partner-row");
  await expect(partnerRows).toHaveCount(4);
  await expect(partnerRows.filter({ hasText: "(kamu)" })).toContainText("bareng p2 · 2 menang dari 3 (67%)");
  await expect(partnerRows.filter({ hasText: /^p3/ })).toContainText("bareng p4 · 1 menang dari 3 (33%)");

  // L10: profil menampilkan win rate dengan semua partner, termasuk yang baru sekali main bareng.
  await partnerRows.filter({ hasText: /^p3/ }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: "p3" })).toBeVisible();
  const rows = page.getByTestId("partner-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("p4");
  await expect(rows.nth(0)).toContainText("Terbaik");
  await expect(rows.nth(0)).toContainText("3 main · 1–2");
  await expect(rows.nth(1)).toContainText("p2");
  await expect(rows.nth(1)).toContainText("1 main · 1–0 · selisih +3");
  await expect(rows.nth(1)).toContainText("100%");
  await expect(rows.nth(2)).toContainText("1 main · 1–0 · selisih +2"); // p1 (host)
});
