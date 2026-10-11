import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("kok per slop: penghitung di papan skor → biaya patungan saat sesi ditutup (§5.5)", async ({ page, browser, baseURL }) => {
  page.on("dialog", (d) => d.accept());
  await signInFast(page, uniqueEmail("kok"));
  const group = await createGroupViaApi(page, "Grup Kok");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id];
  for (const name of ["p2", "p3", "p4"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);

  await page.goto(`/g/${group.id}/sesi/${sessionId}/main`);
  const counter = page.getByTestId("shuttle-counter");
  await expect(counter.getByTestId("shuttle-cost")).toHaveText("Isi harga per slop untuk menghitung biaya.");
  await counter.getByLabel("Harga per slop (Rp)").fill("40000");
  await counter.getByLabel("Harga per slop (Rp)").blur();
  for (let i = 0; i < 5; i++) await counter.getByRole("button", { name: "+ Kok" }).click();
  await counter.getByRole("button", { name: /kurangi kok/ }).click();
  await expect(counter.getByTestId("shuttles-used")).toHaveText("4");
  // §5.5: 40.000 per slop, 4 dipakai → 13.400
  await expect(counter.getByTestId("shuttle-cost")).toHaveText("Biaya kok Rp13.400");
  await expect(counter).toContainText("Tersimpan");
  await expect.poll(async () => (await admin().from("sessions").select("shuttles_used, shuttle_price_per_slop").eq("id", sessionId).single()).data).toEqual({
    shuttles_used: 4,
    shuttle_price_per_slop: 40000,
  });

  // Bukan admin tidak bisa mengubah penghitung.
  const guest = await browser.newContext({ baseURL });
  expect((await guest.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Penonton" } })).status()).toBe(201);
  expect((await guest.request.put(`${api}/shuttle`, { data: { pricePerSlop: 1, perSlop: 12, used: 99 } })).status()).toBe(403);
  await guest.close();

  // Tutup sesi → biaya "Kok (4 buah)" Rp13.400, ditalangi host, rata ke 4 peserta, tercatat di audit_log.
  await page.goto(`/g/${group.id}/sesi/${sessionId}`);
  await page.getByRole("button", { name: "Tutup sesi" }).click();
  await expect(page.getByRole("heading", { name: "Recap mabar" })).toBeVisible();
  const { data: expenses } = await admin().from("expenses").select("name, amount, paid_by, preset, meta, split_all").eq("session_id", sessionId);
  expect(expenses).toEqual([
    { name: "Kok (4 buah)", amount: 13400, paid_by: hostRow!.id, preset: "shuttle", meta: { source: "counter", pricePerSlop: 40000, perSlop: 12, used: 4 }, split_all: true },
  ]);
  const { data: audit } = await admin().from("audit_log").select("action, after").eq("group_id", group.id).eq("entity", "expense");
  expect(audit).toMatchObject([{ action: "create", after: { name: "Kok (4 buah)", amount: 13400 } }]);
  await page.goto(`/g/${group.id}/sesi/${sessionId}/patungan`);
  await expect(page.getByTestId("transfer-amount")).toHaveText(["Rp3.500", "Rp3.500", "Rp3.500"]);

  // Sesi selesai: penghitung terkunci.
  expect((await page.request.put(`${api}/shuttle`, { data: { pricePerSlop: 40000, perSlop: 12, used: 5 } })).status()).toBe(422);
});
