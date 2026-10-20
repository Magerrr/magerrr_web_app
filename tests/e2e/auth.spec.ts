import { expect, test } from "@playwright/test";
import { admin, uniqueEmail } from "./support";

test("Google belum diaktifkan → pesan jelas, bukan error mentah", async ({ page }) => {
  await page.goto("/masuk");
  await page.getByRole("button", { name: "Lanjut dengan Google" }).click();
  // Pesan tampil sebagai toast, lalu `?error=` dihapus dari URL agar tidak muncul lagi saat dimuat ulang.
  await expect(page.getByTestId("toast")).toHaveText("Masuk dengan Google belum bisa dipakai. Pakai email dulu.");
  await expect(page).toHaveURL(/\/masuk\?next=%2F$/);
});

test("tautan masuk rusak → kembali ke /masuk dengan pesan", async ({ page }) => {
  await page.goto("/auth/callback?code=bukan-kode-valid&next=/grup/baru");
  await expect(page.getByTestId("toast")).toContainText("Tautan masuk tidak berlaku atau sudah kedaluwarsa");
  await expect(page).toHaveURL(/\/masuk\?next=%2Fgrup%2Fbaru$/);
});

test("next eksternal diabaikan (anti open redirect), lalu keluar", async ({ page, baseURL }) => {
  const email = uniqueEmail("redirect");
  const db = admin();
  await db.auth.admin.createUser({ email, email_confirm: true });
  const { data } = await db.auth.admin.generateLink({ type: "magiclink", email });
  await page.goto(
    `/auth/callback?token_hash=${data.properties!.hashed_token}&type=magiclink&next=${encodeURIComponent("//evil.example/x")}`,
  );
  await expect(page).toHaveURL(`${baseURL}/`);
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page.getByRole("link", { name: "Masuk", exact: true })).toBeVisible();
});

test("halaman grup menolak pengunjung yang bukan anggota", async ({ page }) => {
  await page.goto("/g/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Masuk dulu" })).toBeVisible();
  await page.goto("/gabung/00000000000000000000000000000000");
  await expect(page.getByRole("heading", { name: "Tautan tidak berlaku" })).toBeVisible();
});
