import { expect, test } from "@playwright/test";
import { createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("grup publik tampil di Jelajahi dan bisa digabung tanpa tautan; grup privat tidak (MAGERRR-6)", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("publik"));
  const name = `Grup Publik ${Date.now()}`;
  const group = await createGroupViaApi(page, name);

  const userCtx = await browser.newContext({ baseURL });
  const user = await userCtx.newPage();
  await signInFast(user, uniqueEmail("penjelajah"));

  // Privat (bawaan): tidak tampil, pratinjau & gabung terbuka ditolak.
  await user.goto(`/jelajah?q=${encodeURIComponent(name)}`);
  await expect(user.getByText(`Tidak ada grup publik bernama "${name}".`)).toBeVisible();
  await user.goto(`/jelajah/${group.id}`);
  await expect(user.getByRole("heading", { name: "Grup tidak ditemukan" })).toBeVisible();
  expect((await user.request.post(`/api/groups/${group.id}/join`, { data: { displayName: "Penjelajah" } })).status()).toBe(404);

  // Admin menjadikan grup publik dari Pengaturan.
  await page.goto(`/g/${group.id}/pengaturan`);
  await page.getByText("Publik", { exact: true }).click();
  await page.getByRole("button", { name: "Simpan pengaturan" }).click();
  await expect(page.getByText("Pengaturan disimpan.")).toBeVisible();

  // Pengguna lain menemukan grup di Jelajahi lalu bergabung dengan akun.
  await user.goto("/");
  await user.getByRole("link", { name: "Jelajahi grup publik" }).click();
  await user.getByLabel("Cari nama grup").fill(name);
  await user.getByLabel("Cari nama grup").press("Enter");
  const card = user.getByTestId("public-groups").getByRole("link", { name: new RegExp(name) });
  await expect(card).toContainText("1 anggota");
  await card.click();
  await expect(user.getByRole("heading", { level: 1, name })).toBeVisible();
  await user.getByLabel("Nama panggilan").fill("Penjelajah");
  await user.getByRole("button", { name: "Gabung grup" }).click();
  await expect(user).toHaveURL(new RegExp(`/g/${group.id}$`));
  await expect(user.getByRole("heading", { level: 1, name })).toBeVisible();

  // Tamu tanpa akun: halaman grup mengarah ke pratinjau, lalu gabung sebagai tamu.
  const guestCtx = await browser.newContext({ baseURL });
  const guest = await guestCtx.newPage();
  await guest.goto(`/g/${group.id}`);
  await expect(guest).toHaveURL(new RegExp(`/jelajah/${group.id}$`));
  await expect(guest.getByText("Grup publik · 2 anggota")).toBeVisible();
  await guest.getByLabel("Nama panggilan").fill("Tamu Publik");
  await guest.getByRole("button", { name: "Gabung grup" }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${group.id}$`));
  await expect(guest.getByText("Tamu", { exact: true })).toBeVisible();

  // Kembali privat: hilang dari daftar dan gabung terbuka ditolak; anggota yang sudah ada tetap.
  expect((await page.request.patch(`/api/groups/${group.id}`, { data: { isPublic: false } })).status()).toBe(200);
  const lateCtx = await browser.newContext({ baseURL });
  expect((await lateCtx.request.post(`/api/groups/${group.id}/join`, { data: { displayName: "Telat" } })).status()).toBe(404);
  await user.goto(`/jelajah?q=${encodeURIComponent(name)}`);
  await expect(user.getByTestId("public-groups")).toHaveCount(0);
  await user.goto(`/g/${group.id}`);
  await expect(user).toHaveURL(new RegExp(`/g/${group.id}$`));
  await expect(user.getByRole("heading", { level: 1, name })).toBeVisible();

  await userCtx.close();
  await guestCtx.close();
  await lateCtx.close();
});
