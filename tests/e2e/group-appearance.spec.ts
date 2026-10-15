import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("admin mengatur warna tema, logo, dan sampul grup; gambar hanya untuk anggota kecuali grup publik (MAGERRR-8)", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("tema"));
  const group = await createGroupViaApi(page, "Grup Tema");
  const media = (kind: string) => `/api/groups/${group.id}/media/${kind}`;

  // Warna tema dari Pengaturan → pita sampul beranda berwarna sky-pop.
  await page.goto(`/g/${group.id}/pengaturan`);
  await page.getByText("Biru", { exact: true }).click();
  await page.getByRole("button", { name: "Simpan pengaturan" }).click();
  await expect(page.getByText("Pengaturan disimpan.")).toBeVisible();
  // Tema di luar preset ditolak.
  expect((await page.request.patch(`/api/groups/${group.id}`, { data: { theme: "ungu" } })).status()).toBe(400);

  // Unggah logo & sampul lewat UI.
  await page.getByLabel("Logo", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Logo grup saat ini" })).toBeVisible();
  await page.getByLabel("Gambar sampul", { exact: true }).setInputFiles({ name: "sampul.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Gambar sampul grup saat ini" })).toBeVisible();
  // Bukan gambar → ditolak meski mengaku PNG.
  const fake = await page.request.post(media("logo"), { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") } } });
  expect(fake.status()).toBe(422);

  await page.goto(`/g/${group.id}`);
  const cover = page.getByTestId("group-cover");
  await expect(cover).toHaveCSS("background-color", "rgb(43, 160, 255)");
  await expect(cover.locator("img")).toHaveAttribute("src", /\/media\/cover\?v=/);
  expect((await page.request.get(media("cover"))).status()).toBe(200);

  // Anggota biasa tidak bisa mengubah; orang luar tidak bisa melihat gambar grup privat.
  const memberCtx = await browser.newContext({ baseURL });
  expect((await memberCtx.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Anggota" } })).status()).toBe(201);
  expect((await memberCtx.request.get(media("logo"))).status()).toBe(200);
  expect((await memberCtx.request.delete(media("logo"))).status()).toBe(403);
  const outsider = await browser.newContext({ baseURL });
  expect((await outsider.request.get(media("logo"))).status()).toBe(404);
  // Grup publik: gambar bisa dilihat siapa pun (daftar Jelajahi).
  expect((await page.request.patch(`/api/groups/${group.id}`, { data: { isPublic: true } })).status()).toBe(200);
  expect((await outsider.request.get(media("logo"))).status()).toBe(200);

  // Hapus logo → berkas di Storage ikut terhapus.
  const { data: before } = await admin().from("groups").select("logo_path").eq("id", group.id).single();
  await page.goto(`/g/${group.id}/pengaturan`);
  await page.getByRole("button", { name: "Hapus logo" }).click();
  await expect(page.getByRole("img", { name: "Logo grup saat ini" })).toHaveCount(0);
  const { data: after } = await admin().from("groups").select("logo_path").eq("id", group.id).single();
  expect(after!.logo_path).toBeNull();
  const listed = await admin().storage.from("group-media").list(`${group.id}/logo`);
  expect(listed.data?.map((f) => f.name) ?? []).not.toContain(before!.logo_path!.split("/").pop());

  await memberCtx.close();
  await outsider.close();
});
