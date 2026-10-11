import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("live scoreboard: penonton tanpa login & anggota melihat skor berjalan tanpa memuat ulang (SC8)", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("live"));
  const group = await createGroupViaApi(page, "Grup Live");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id];
  for (const name of ["p2", "p3", "p4"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Live", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  const { data: token } = await admin().from("sessions").select("share_token").eq("id", sessionId).single();
  const livePath = `/s/${token!.share_token}/skor`;

  // Sebelum mulai.
  const visitor = await (await browser.newContext({ baseURL })).newPage();
  await visitor.goto(livePath);
  await expect(visitor.getByText("Sesi belum dimulai.")).toBeVisible();

  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  const started = await page.request.post(`${api}/matches/start`, {
    data: { matches: [{ courtNo: 1, kind: "doubles", A: [ids[0], ids[1]], B: [ids[2], ids[3]] }], seed: 1, queue: null },
  });
  const [matchId] = (await started.json()).ids as string[];

  await visitor.goto(livePath);
  await expect(visitor.getByText("Diperbarui otomatis tiap 3 detik.")).toBeVisible();
  await expect(visitor.getByTestId("live-score-A")).toHaveText("0");

  // Anggota tamu membuka papan skor read-only.
  const memberCtx = await browser.newContext({ baseURL });
  expect((await memberCtx.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Penonton" } })).status()).toBe(201);
  const member = await memberCtx.newPage();
  await member.goto(`/g/${group.id}/sesi/${sessionId}/main`);
  await expect(member.getByText("Diperbarui otomatis tiap 3 detik.")).toBeVisible();
  await expect(member.getByTestId("court-1")).toContainText("0–0");

  // Host mencatat poin → kedua layar berubah sendiri.
  expect((await page.request.put(`${api}/matches/${matchId}/score`, { data: { games: [{ a: 3, b: 1 }] } })).status()).toBe(200);
  await expect(visitor.getByTestId("live-score-A")).toHaveText("3", { timeout: 10_000 });
  await expect(visitor.getByTestId("live-score-B")).toHaveText("1");
  await expect(member.getByTestId("court-1")).toContainText("3–1", { timeout: 10_000 });

  // Match selesai → hasil terakhir.
  expect((await page.request.post(`${api}/matches/${matchId}/complete`, { data: { games: [{ a: 21, b: 12 }] } })).status()).toBe(200);
  await expect(visitor.getByTestId("live-recent")).toContainText("21–12", { timeout: 10_000 });
  await expect(visitor.getByTestId("live-court-1")).toContainText("Kosong");

  expect((await visitor.request.get(`/s/${"a".repeat(32)}/skor`)).status()).toBe(404);
  await visitor.context().close();
  await memberCtx.close();
});
