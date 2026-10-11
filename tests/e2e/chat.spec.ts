import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("obrolan grup: kirim, terima lewat polling, penanda pesan baru, hapus & moderasi, akses", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  await signInFast(page, uniqueEmail("chat"));
  const group = await createGroupViaApi(page, "Grup Ngobrol");
  const api = `/api/groups/${group.id}/chat`;

  const guestCtx = await browser.newContext({ baseURL });
  const guest = await guestCtx.newPage();
  await guest.goto(`/gabung/${group.inviteCode}`);
  await guest.getByLabel("Nama panggilan").fill("Budi");
  await guest.getByRole("button", { name: "Gabung grup" }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${group.id}$`));
  await expect(guest.getByRole("link", { name: /Obrolan/ })).toContainText("Ngobrol dengan anggota grup");

  // Admin mengirim lewat UI; isi ditampilkan sebagai teks (bukan HTML).
  await page.goto(`/g/${group.id}/obrolan`);
  await expect(page.getByText("Belum ada pesan.")).toBeVisible();
  await page.getByLabel("Tulis pesan").fill("Sabtu jam 7 ya <b>tebal</b>");
  await page.getByRole("button", { name: "Kirim" }).click();
  const log = page.getByTestId("chat-log");
  await expect(log).toContainText("Sabtu jam 7 ya <b>tebal</b>");
  await expect(page.getByLabel("Tulis pesan")).toHaveValue("");

  // Tamu melihat penanda pesan baru, lalu pesannya; membuka obrolan menandai sudah dibaca.
  await guest.reload();
  await expect(guest.getByRole("link", { name: /Obrolan/ })).toContainText("1 pesan baru");
  await guest.getByRole("link", { name: /Obrolan/ }).click();
  await expect(guest.getByTestId("chat-log")).toContainText("Sabtu jam 7 ya");
  await guest.getByLabel("Tulis pesan").fill("Siap, aku bawa kok");
  await guest.getByRole("button", { name: "Kirim" }).click();
  await expect(guest.getByTestId("chat-log")).toContainText("Siap, aku bawa kok");
  // Pesan tamu sampai ke admin lewat polling (tanpa muat ulang).
  await expect(log).toContainText("Budi");
  await expect(log).toContainText("Siap, aku bawa kok");
  await guest.goto(`/g/${group.id}`);
  await expect(guest.getByRole("link", { name: /Obrolan/ })).toContainText("Ngobrol dengan anggota grup");

  // Tamu tidak bisa menghapus pesan orang lain; pesannya sendiri bisa, lalu hilang juga di layar admin.
  const { data: rows } = await admin().from("chat_messages").select("id, body").eq("group_id", group.id).order("id");
  expect(rows!.map((r) => r.body)).toEqual(["Sabtu jam 7 ya <b>tebal</b>", "Siap, aku bawa kok"]);
  expect((await guest.request.delete(`${api}/${rows![0].id}`)).status()).toBe(403);
  await guest.goto(`/g/${group.id}/obrolan`);
  await guest.getByRole("button", { name: /Siap, aku bawa kok/ }).click();
  await guest.getByRole("button", { name: "Hapus pesan" }).click();
  await expect(guest.getByTestId("chat-log")).toContainText("Pesan dihapus");
  await expect(log).toContainText("Pesan dihapus");
  await expect(log).not.toContainText("Siap, aku bawa kok");
  const { data: deleted } = await admin().from("chat_messages").select("body, deleted_at").eq("id", rows![1].id).single();
  expect(deleted!.body).toBe("");
  expect(deleted!.deleted_at).not.toBeNull();

  // Admin boleh menghapus pesan siapa pun (moderasi).
  const guestMessage = await guest.request.post(api, { data: { body: "pesan untuk dimoderasi" } });
  expect(guestMessage.status()).toBe(201);
  expect((await page.request.delete(`${api}/${(await guestMessage.json()).id}`)).status()).toBe(204);

  // Validasi & batas kirim.
  expect((await page.request.post(api, { data: { body: "   " } })).status()).toBe(400);
  expect((await page.request.post(api, { data: { body: "x".repeat(1001) } })).status()).toBe(400);
  const burst = [];
  for (let i = 0; i < 6; i++) burst.push((await guest.request.post(api, { data: { body: `spam ${i}` } })).status());
  // Maksimal 5 pesan per 10 detik per anggota (pesan tamu sebelumnya bisa ikut terhitung).
  expect(burst[0]).toBe(201);
  expect(burst.at(-1)).toBe(429);
  expect(burst.filter((s) => s === 201).length).toBeLessThanOrEqual(5);

  // Bukan anggota → ditolak.
  const stranger = await browser.newContext({ baseURL });
  expect((await stranger.request.get(api)).status()).toBe(401);
  expect((await stranger.request.post(api, { data: { body: "halo" } })).status()).toBe(401);
  await stranger.close();
  await guestCtx.close();
});
