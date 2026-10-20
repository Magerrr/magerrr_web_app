import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, magicLinkFromMailpit, signInFast, uniqueEmail } from "./support";

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("edit profil: nama ikut ke grup, foto profil, ganti email dengan konfirmasi (MAGERRR-12)", async ({ page, browser, baseURL }) => {
  const oldEmail = uniqueEmail("akun");
  await signInFast(page, oldEmail);
  const groupA = await createGroupViaApi(page, `Grup Akun A ${Date.now()}`);
  const groupB = await createGroupViaApi(page, `Grup Akun B ${Date.now()}`);
  const newName = `Nama ${Date.now() % 100000}`;
  // Di grup B nama itu sudah dipakai anggota lain → nama di grup B tidak ikut diganti.
  expect((await page.request.post(`/api/groups/${groupB.id}/members`, { data: { displayName: newName } })).status()).toBe(201);

  await page.goto("/profil");
  await expect(page.getByLabel("Nama tampilan")).toHaveValue(oldEmail.split("@")[0]);
  await expect(page.getByTestId("account-email")).toContainText(oldEmail);

  // Nama
  await page.getByLabel("Nama tampilan").fill(newName);
  await page.getByRole("button", { name: "Simpan nama" }).click();
  await expect(page.getByText(`Di Grup Akun B`)).toBeVisible();
  await expect(page.getByLabel("Nama tampilan")).toHaveValue(newName);
  const { data: rows } = await admin().from("members").select("group_id, display_name").in("group_id", [groupA.id, groupB.id]).not("user_id", "is", null);
  expect(rows?.find((r) => r.group_id === groupA.id)?.display_name).toBe(newName);
  expect(rows?.find((r) => r.group_id === groupB.id)?.display_name).toBe(oldEmail.split("@")[0]);
  expect((await page.request.patch("/api/profil", { data: { displayName: " ", applyToGroups: false } })).status()).toBe(400);

  // Foto profil
  await page.locator('input[type="file"]').setInputFiles({ name: "saya.png", mimeType: "image/png", buffer: PNG });
  // Langkah potong manual 1:1 sebelum disimpan.
  const crop = page.getByTestId("photo-crop");
  await expect(crop.getByRole("heading", { name: "Atur foto profil" })).toBeVisible();
  await crop.getByRole("button", { name: "Simpan foto" }).click();
  await expect(crop).toBeHidden();
  await expect(page.getByRole("button", { name: "Hapus foto" })).toBeVisible();
  await expect(page.getByTestId("user-avatar").first().locator("img")).toBeVisible();
  const own = await page.request.get("/api/profil/foto");
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toMatch(/^image\//);
  expect((await page.request.post("/api/profil/foto", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg>") } } })).status()).toBe(422);

  // Foto tampil untuk sesama anggota, tidak untuk orang luar.
  const { data: me } = await admin().from("members").select("id").eq("group_id", groupA.id).not("user_id", "is", null).single();
  const memberPhoto = `/api/groups/${groupA.id}/members/${me!.id}/foto`;
  expect((await page.request.get(memberPhoto)).status()).toBe(200);
  await page.goto(`/g/${groupA.id}/anggota/${me!.id}`);
  await expect(page.getByTestId("user-avatar").locator("img")).toBeVisible();
  const outsider = await browser.newContext({ baseURL });
  expect((await outsider.request.get(memberPhoto)).status()).toBe(404);
  expect((await outsider.request.get("/api/profil/foto")).status()).toBe(401);
  await outsider.close();

  // Ganti email: tautan konfirmasi dikirim; email baru berlaku setelah dikonfirmasi.
  await page.goto("/profil");
  const newEmail = uniqueEmail("akunbaru");
  expect((await page.request.post("/api/profil/email", { data: { email: oldEmail } })).status()).toBe(422);
  await page.getByLabel("Email baru").fill(newEmail);
  await page.getByRole("button", { name: "Kirim tautan konfirmasi" }).click();
  await expect(page.getByTestId("pending-email")).toContainText(newEmail);
  await expect(page.getByTestId("account-email")).toContainText(oldEmail);

  // Tautan konfirmasi di email lama; bila server masih menunggu konfirmasi kedua (double_confirm_changes),
  // halaman memintanya dan tautan di email baru menyelesaikannya.
  await page.goto(await magicLinkFromMailpit(page.request, oldEmail, "new email address"));
  const waiting = page.getByText("Buka juga tautan konfirmasi di email satunya");
  const done = page.getByText("Email akunmu sudah diganti.");
  await expect(waiting.or(done)).toBeVisible();
  if (await waiting.isVisible()) {
    await expect(page.getByTestId("account-email")).toContainText(oldEmail);
    await page.goto(await magicLinkFromMailpit(page.request, newEmail, "new email address"));
  }
  await expect(page.getByText("Email akunmu sudah diganti.")).toBeVisible();
  await expect(page.getByTestId("account-email")).toContainText(newEmail);

  // Hapus foto
  await page.getByRole("button", { name: "Hapus foto" }).click();
  await expect(page.getByRole("button", { name: "Hapus foto" })).toHaveCount(0);
  expect((await page.request.get("/api/profil/foto")).status()).toBe(404);
});

test("profil butuh akun: pengunjung diarahkan ke Masuk", async ({ page }) => {
  await page.goto("/profil");
  await expect(page).toHaveURL(/\/masuk\?next=(%2F|\/)profil$/);
});
