import { expect, test, type Locator, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

/** Seret dengan pointer (mouse) dari tengah `from` ke tengah `to`, melewati beberapa titik agar melewati ambang seret. */
async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test("pilih lapangan sebelum kocok, seret susunan ke lapangan lain, seret nama untuk menukar (MAGERRR-10)", async ({ page }) => {
  await signInFast(page, uniqueEmail("lapangan"));
  const group = await createGroupViaApi(page, "Grup Lapangan");
  const api = `/api/groups/${group.id}`;
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const guests: string[] = [];
  for (const name of ["Ani", "Beni", "Caca", "Dedi", "Eka"]) {
    guests.push((await (await page.request.post(`${api}/members`, { data: { displayName: name } })).json()).id);
  }
  const created = await page.request.post(`${api}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR", courtCount: 3, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: [hostRow!.id, ...guests], costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const s = `${api}/sessions/${sessionId}`;
  expect((await page.request.post(`${s}/status`, { data: { status: "running" } })).status()).toBe(200);
  // Lapangan di luar yang kosong ditolak.
  expect((await page.request.post(`${s}/plan`, { data: { kind: "doubles", seed: 1, courts: [4] } })).status()).toBe(409);

  await page.goto(`/g/${group.id}/sesi/${sessionId}/main`);
  // Hanya lapangan 3 yang diisi.
  await page.getByLabel("Lapangan 1", { exact: true }).uncheck();
  await page.getByLabel("Lapangan 2", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Kocok ronde" }).click();
  await expect(page.getByTestId("proposal-court-3")).toBeVisible();
  await expect(page.getByTestId("free-court-1")).toBeVisible();
  await expect(page.getByTestId("free-court-2")).toBeVisible();

  // Seret pegangan susunan lapangan 3 ke lapangan 1.
  await drag(page, page.getByTestId("proposal-court-3").getByTitle("Seret untuk pindah lapangan"), page.getByTestId("free-court-1"));
  await expect(page.getByTestId("proposal-court-1")).toBeVisible();
  await expect(page.getByTestId("free-court-3")).toBeVisible();

  // Seret nama pertama di lapangan ke pemain yang istirahat: keduanya bertukar.
  const court = page.getByTestId("proposal-court-1");
  const first = court.getByRole("button").first();
  const resting = page.getByRole("button", { name: /^1 / });
  const before = [(await first.textContent())!.trim(), (await resting.textContent())!.replace(/^1/, "").trim()];
  // Seret bisa meleset bila handler belum terpasang (hidrasi); ulangi hanya selama belum bertukar.
  await expect(async () => {
    await drag(page, first, resting);
    await expect(court.getByRole("button").first()).toHaveText(before[1], { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^1 / })).toContainText(before[0]);

  // Alternatif tanpa seret: pilihan lapangan.
  await page.getByLabel("Pindahkan susunan lapangan 1 ke").selectOption("2");
  await expect(page.getByTestId("proposal-court-2")).toBeVisible();

  await page.getByRole("button", { name: "Mulai main" }).click();
  await expect(page.getByTestId("score-A")).toBeVisible();
  const { data: running } = await admin().from("matches").select("court_no").eq("session_id", sessionId).eq("status", "running");
  expect(running!.map((m) => m.court_no)).toEqual([2]);
});
