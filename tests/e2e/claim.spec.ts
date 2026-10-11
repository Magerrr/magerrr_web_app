import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("klaim profil tamu ke akun: tamu lewat undangan & tamu manual lewat tautan admin (G6)", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("klaim-host"));
  const group = await createGroupViaApi(page, "Grup Klaim");

  // 1. Tamu lewat undangan (cookie) lalu masuk dengan akun dan mengklaim dari halaman grup.
  const guestCtx = await browser.newContext({ baseURL });
  const guest = await guestCtx.newPage();
  await guest.goto(`/gabung/${group.inviteCode}`);
  await guest.getByLabel("Nama panggilan").fill("Budi");
  await guest.getByRole("button", { name: "Gabung grup" }).click();
  await expect(guest.getByTestId("claim-card")).toBeVisible();
  const { data: budi } = await admin().from("members").select("id, claim_token").eq("group_id", group.id).eq("display_name", "Budi").single();
  await guest.getByRole("link", { name: "Klaim profil" }).click();
  await expect(guest.getByRole("heading", { name: "Klaim profil Budi" })).toBeVisible();
  // Belum login → masuk dulu, lalu kembali ke tautan klaim.
  await expect(guest.getByRole("link", { name: "Masuk untuk mengklaim" })).toHaveAttribute("href", `/masuk?next=${encodeURIComponent(`/klaim/${budi!.claim_token}`)}`);
  const email = uniqueEmail("budi");
  await signInFast(guest, email);
  await guest.goto(`/klaim/${budi!.claim_token}`);
  await guest.getByRole("button", { name: "Klaim profil Budi" }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${group.id}$`));
  await expect(guest.getByText("sebagai Budi")).toBeVisible();
  await expect(guest.getByTestId("claim-card")).toHaveCount(0);
  const { data: users } = await admin().auth.admin.listUsers({ perPage: 1000 });
  const userId = users.users.find((u) => u.email === email)!.id;
  expect((await admin().from("members").select("user_id, claim_token").eq("id", budi!.id).single()).data).toEqual({ user_id: userId, claim_token: null });
  // Token lama tidak berlaku lagi.
  expect((await guest.request.post(`/api/claim/${budi!.claim_token}`)).status()).toBe(404);
  await guest.goto(`/klaim/${budi!.claim_token}`);
  await expect(guest.getByText("Tautan klaim tidak berlaku")).toBeVisible();

  // 2. Tamu ditambahkan manual: admin membagikan tautan klaim dari profilnya.
  const sinta = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: "Sinta" } })).json()).id as string;
  await page.goto(`/g/${group.id}/anggota/${sinta}`);
  await expect(page.getByTestId("claim-link")).toBeVisible();
  const { data: sintaRow } = await admin().from("members").select("claim_token").eq("id", sinta).single();
  // Akun Budi sudah punya profil di grup ini → tidak bisa mengklaim profil kedua.
  const twice = await guest.request.post(`/api/claim/${sintaRow!.claim_token}`);
  expect(twice.status()).toBe(409);
  // Akun lain berhasil.
  const sintaCtx = await browser.newContext({ baseURL });
  const sintaPage = await sintaCtx.newPage();
  await signInFast(sintaPage, uniqueEmail("sinta"));
  await sintaPage.goto(`/klaim/${sintaRow!.claim_token}`);
  await sintaPage.getByRole("button", { name: "Klaim profil Sinta" }).click();
  await expect(sintaPage.getByText("sebagai Sinta")).toBeVisible();
  // Admin tidak lagi melihat tautan klaim untuk profil berakun; tanpa login → 401.
  await page.reload();
  await expect(page.getByTestId("claim-link")).toHaveCount(0);
  const anon = await browser.newContext({ baseURL });
  expect((await anon.request.post(`/api/claim/${"1".repeat(32)}`)).status()).toBe(401);
  await Promise.all([anon.close(), sintaCtx.close(), guestCtx.close()]);
});
