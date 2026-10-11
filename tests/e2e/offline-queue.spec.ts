import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("antrian skor offline: skor & 'Simpan hasil' bertahan saat halaman dimuat ulang offline, terkirim saat online", async ({ page, context }) => {
  await signInFast(page, uniqueEmail("antrian"));
  const group = await createGroupViaApi(page, "Grup Antrian");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id];
  for (const name of ["p2", "p3", "p4"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: { target: 11, deuce: false, cap: 11 }, matchGames: 1, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  const started = await page.request.post(`${api}/matches/start`, {
    data: { matches: [{ courtNo: 1, kind: "doubles", A: [ids[0], ids[1]], B: [ids[2], ids[3]] }], seed: 1, queue: null },
  });
  const [matchId] = (await started.json()).ids as string[];
  const games = async () => (await admin().from("games").select("score_a, score_b").eq("match_id", matchId).single()).data;

  // Service worker mengendalikan halaman & papan skor tersimpan untuk dibuka offline.
  const board = `/g/${group.id}/sesi/${sessionId}/main`;
  await page.goto(board);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null)).toBe("activated");
  await page.reload();
  await page.waitForLoadState("networkidle");

  const court = page.getByTestId("court-1");
  const plusA = court.getByRole("button", { name: /^Tambah poin/ }).nth(0);
  await plusA.click();
  await expect(court.getByTestId("sync-status")).toHaveText("Tersimpan");

  // Offline: 2 poin lagi, lalu halaman dimuat ulang (dari salinan service worker).
  await context.setOffline(true);
  await plusA.click();
  await plusA.click();
  await expect(court.getByTestId("score-A")).toHaveText("3");
  await expect(court.getByTestId("sync-status")).toHaveText("Belum tersinkron. Mencoba lagi…");
  await page.reload();
  await expect(page.getByTestId("court-1").getByTestId("score-A")).toHaveText("3");
  expect(await games()).toEqual({ score_a: 1, score_b: 0 });

  // Online kembali → antrian terkirim sendiri.
  await context.setOffline(false);
  await expect.poll(games, { timeout: 15_000 }).toEqual({ score_a: 3, score_b: 0 });

  // Sampai 11–0 lalu "Simpan hasil" saat offline → tersimpan di perangkat, termasuk setelah muat ulang.
  for (let i = 3; i < 11; i++) await page.getByTestId("court-1").getByRole("button", { name: /^Tambah poin/ }).nth(0).click();
  await expect(page.getByTestId("court-1").getByTestId("sync-status")).toHaveText("Tersimpan");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Simpan hasil" }).click();
  await expect(page.getByText("Hasil disimpan di perangkat ini dan dikirim otomatis begitu online.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Hasil disimpan di perangkat ini dan dikirim otomatis begitu online.")).toBeVisible();
  expect((await admin().from("matches").select("status").eq("id", matchId).single()).data!.status).toBe("running");

  await context.setOffline(false);
  await expect.poll(async () => (await admin().from("matches").select("status, winner").eq("id", matchId).single()).data, { timeout: 15_000 }).toEqual({
    status: "completed",
    winner: "A",
  });
  await expect(page.getByTestId("match-history")).toContainText("11", { timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem("magerrr:antrian-skor"))).toBe("[]");
});
