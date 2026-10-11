import { expect, test } from "@playwright/test";
import { createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("sidebar desktop: menu grup, penanda aktif, pesan baru, pindah grup; tidak tampil di ponsel & untuk bukan anggota", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  await signInFast(page, uniqueEmail("sidebar"));
  const group = await createGroupViaApi(page, "Grup Sidebar");
  const other = await createGroupViaApi(page, "Grup Kedua");

  // Tamu bergabung dan mengirim pesan → admin punya 1 pesan baru.
  const guestCtx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const guest = await guestCtx.newPage();
  await guest.goto(`/gabung/${group.inviteCode}`);
  await guest.getByLabel("Nama panggilan").fill("Budi");
  await guest.getByRole("button", { name: "Gabung grup" }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${group.id}$`));
  expect((await guest.request.post(`/api/groups/${group.id}/chat`, { data: { body: "Halo semua" } })).status()).toBe(201);

  // Ponsel (proyek Pixel 7): tanpa sidebar, menu ada di halaman grup.
  await page.goto(`/g/${group.id}`);
  const sidebar = page.getByRole("navigation", { name: "Navigasi grup" });
  const pageMenu = page.getByRole("navigation", { name: "Menu grup" });
  await expect(pageMenu).toBeVisible();
  await expect(sidebar).toBeHidden();

  // Desktop: sidebar menggantikan menu halaman grup.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(sidebar).toBeVisible();
  await expect(pageMenu).toBeHidden();
  await expect(sidebar.getByRole("link", { name: "Sesi" })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("link", { name: /Obrolan/ })).toHaveAccessibleName(/^Obrolan\s*,\s*1 pesan baru$/);
  await expect(sidebar.getByRole("link", { name: "Pengaturan grup" })).toBeVisible();

  // Pindah lewat sidebar: penanda aktif ikut; setelah obrolan dibuka, penanda pesan baru hilang.
  await sidebar.getByRole("link", { name: "Leaderboard" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${group.id}/leaderboard$`));
  await expect(sidebar.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("link", { name: "Sesi" })).not.toHaveAttribute("aria-current");
  await sidebar.getByRole("link", { name: /Obrolan/ }).click();
  await expect(page.getByTestId("chat-log")).toContainText("Halo semua");
  await expect(sidebar.getByRole("link", { name: "Obrolan", exact: true })).toHaveAttribute("aria-current", "page");
  await sidebar.getByRole("link", { name: "Anggota" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${group.id}/anggota$`));
  await expect(sidebar.getByRole("link", { name: "Obrolan", exact: true })).toBeVisible();
  // Sub-halaman (profil anggota) menandai menu induknya.
  await page.getByTestId("member-row").first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/g/${group.id}/anggota/[0-9a-f-]{36}$`));
  await expect(sidebar.getByRole("link", { name: "Anggota" })).toHaveAttribute("aria-current", "true");

  // Grup lain milik pengguna bisa dibuka langsung.
  await page.getByRole("complementary", { name: "Navigasi samping" }).getByRole("link", { name: "Grup Kedua" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${other.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Grup Kedua" })).toBeVisible();

  // Tamu: tanpa menu admin, dengan tautan masuk.
  await guest.goto(`/g/${group.id}`);
  const guestSidebar = guest.getByRole("complementary", { name: "Navigasi samping" });
  await expect(guestSidebar.getByRole("link", { name: "Kiko kamu" })).toBeVisible();
  await expect(guestSidebar.getByRole("link", { name: "Pengaturan grup" })).toHaveCount(0);
  await expect(guestSidebar.getByRole("link", { name: "Masuk" })).toBeVisible();
  await guestCtx.close();

  // Bukan anggota: halaman "Masuk dulu" tanpa sidebar.
  const strangerCtx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const stranger = await strangerCtx.newPage();
  await stranger.goto(`/g/${group.id}`);
  await expect(stranger.getByRole("heading", { name: "Masuk dulu" })).toBeVisible();
  await expect(stranger.getByRole("complementary")).toHaveCount(0);
  await strangerCtx.close();
});
