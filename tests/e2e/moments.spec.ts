import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const photo = (name = "foto.png") => ({ name, mimeType: "image/png", buffer: PNG });

test("anggota mengunggah momen, tampil di beranda & galeri, hapus oleh pemilik/admin, thumbnail Jelajahi (MAGERRR-9)", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("momen"));
  const group = await createGroupViaApi(page, `Grup Momen ${Date.now()}`);
  const api = `/api/groups/${group.id}/moments`;
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Momen", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: [hostRow!.id], costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;

  // Tamu (tanpa akun) mengunggah lewat UI dengan keterangan & sesi.
  const guestCtx = await browser.newContext({ baseURL });
  const guest = await guestCtx.newPage();
  await guest.goto(`/gabung/${group.inviteCode}`);
  await guest.getByLabel("Nama panggilan").fill("Tamu Foto");
  await guest.getByRole("button", { name: "Gabung grup" }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${group.id}$`));
  await guest.getByRole("link", { name: "Momen grup" }).click();
  await expect(guest.getByText("Belum ada foto.")).toBeVisible();
  await guest.getByLabel("Foto", { exact: true }).setInputFiles(photo());
  await guest.getByLabel("Keterangan (opsional)").fill("Smash pertama");
  await guest.getByLabel("Sesi (opsional)").selectOption(sessionId);
  await guest.getByRole("button", { name: "Unggah foto" }).click();
  const gallery = guest.getByTestId("moment-list");
  await expect(gallery.getByRole("img", { name: "Smash pertama" })).toBeVisible();
  await expect(gallery).toContainText("Tamu Foto");
  await expect(gallery).toContainText("GOR Momen");

  // Validasi server: bukan gambar, keterangan terlalu panjang, sesi grup lain.
  expect((await page.request.post(api, { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg>") }, caption: "", sessionId: "" } })).status()).toBe(422);
  expect((await page.request.post(api, { multipart: { file: photo(), caption: "x".repeat(201), sessionId: "" } })).status()).toBe(400);
  expect((await page.request.post(api, { multipart: { file: photo(), caption: "", sessionId: "00000000-0000-4000-8000-000000000000" } })).status()).toBe(422);

  // Admin mengunggah; tamu tidak bisa menghapus foto admin, admin bisa menghapus foto tamu.
  const adminUpload = await page.request.post(api, { multipart: { file: photo(), caption: "Foto admin", sessionId: "" } });
  expect(adminUpload.status()).toBe(201);
  const adminMoment = (await adminUpload.json()).id as string;
  expect((await guestCtx.request.delete(`${api}/${adminMoment}`)).status()).toBe(403);

  await page.goto(`/g/${group.id}`);
  await expect(page.getByTestId("recent-moments").getByRole("img")).toHaveCount(2);

  // Gambar grup privat tidak terbuka untuk orang luar; grup publik → thumbnail Jelajahi dari momen terbaru.
  const outsider = await browser.newContext({ baseURL });
  expect((await outsider.request.get(`${api}/${adminMoment}/image`)).status()).toBe(404);
  expect((await page.request.patch(`/api/groups/${group.id}`, { data: { isPublic: true } })).status()).toBe(200);
  expect((await outsider.request.get(`${api}/${adminMoment}/image`)).status()).toBe(200);
  const explore = await outsider.newPage();
  await explore.goto(`/jelajah?q=${encodeURIComponent("Grup Momen")}`);
  await expect(explore.getByTestId("public-groups").locator(`img[src="${api}/${adminMoment}/image"]`)).toHaveCount(1);

  await page.goto(`/g/${group.id}/momen`);
  page.on("dialog", (d) => d.accept());
  const guestCard = page.getByTestId("moment-list").getByRole("listitem").filter({ hasText: "Tamu Foto" });
  await guestCard.getByRole("button", { name: /Hapus/ }).click();
  await expect(page.getByTestId("moment-list").getByRole("img")).toHaveCount(1);

  // Hapus grup ikut menghapus berkas momen.
  expect((await admin().storage.from("group-media").list(`${group.id}/moments`)).data).toHaveLength(1);
  expect((await page.request.delete(`/api/groups/${group.id}`, { data: { confirmName: (await admin().from("groups").select("name").eq("id", group.id).single()).data!.name } })).status()).toBe(204);
  expect((await admin().storage.from("group-media").list(`${group.id}/moments`)).data).toHaveLength(0);

  await guestCtx.close();
  await outsider.close();
});
