import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("admin menghapus grup beserta sesi, patungan, obrolan, dan QRIS; bukan admin ditolak", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("hapus"));
  const group = await createGroupViaApi(page, "Grup Dihapus");
  const api = `/api/groups/${group.id}`;
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const guestId = (await (await page.request.post(`${api}/members`, { data: { displayName: "Tamu" } })).json()).id as string;

  // Data yang memakai trigger audit (biaya, status lunas) dan berkas Storage (QRIS).
  const created = await page.request.post(`${api}/sessions`, {
    data: {
      date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR", courtCount: 1, playMode: "kocok",
      rules: null, matchGames: null, note: null, attendeeIds: [hostRow!.id, guestId],
      costs: { courtPerHour: 60000, shuttle: null },
    },
  });
  expect(created.status()).toBe(201);
  const sessionId = (await created.json()).id as string;
  const { data: settlement } = await admin().from("settlements").select("id").eq("session_id", sessionId).single();
  expect((await page.request.patch(`${api}/sessions/${sessionId}/settlements/${settlement!.id}`, { data: { action: "paid" } })).status()).toBe(200);
  expect((await page.request.post(`${api}/chat`, { data: { body: "Halo" } })).status()).toBe(201);
  const qris = await page.request.post(`${api}/payment-infos/qris`, {
    multipart: { label: "QRIS", file: { name: "qris.png", mimeType: "image/png", buffer: PNG } },
  });
  expect(qris.status()).toBe(201);
  const { data: info } = await admin().from("payment_infos").select("qr_image_path").eq("member_id", hostRow!.id).single();

  // Anggota biasa dan tamu tidak boleh menghapus.
  const memberCtx = await browser.newContext({ baseURL });
  const member = await memberCtx.newPage();
  await signInFast(member, uniqueEmail("anggota"));
  expect((await member.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Anggota" } })).status()).toBe(201);
  expect((await member.request.delete(api, { data: { confirmName: "Grup Dihapus" } })).status()).toBe(403);
  // Nama salah → 422.
  expect((await page.request.delete(api, { data: { confirmName: "Grup Lain" } })).status()).toBe(422);

  await page.goto(`/g/${group.id}/pengaturan`);
  const button = page.getByRole("button", { name: "Hapus grup ini" });
  await expect(button).toBeDisabled();
  await page.getByLabel('Ketik "Grup Dihapus" untuk konfirmasi').fill("Grup Dihapus");
  await button.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /Grup Dihapus/ })).toHaveCount(0);

  const db = admin();
  expect((await db.from("groups").select("id").eq("id", group.id)).data).toEqual([]);
  expect((await db.from("members").select("id").eq("group_id", group.id)).data).toEqual([]);
  expect((await db.from("sessions").select("id").eq("id", sessionId)).data).toEqual([]);
  expect((await db.from("audit_log").select("id").eq("group_id", group.id)).data).toEqual([]);
  const stored = await db.storage.from("qris").list(`${group.id}/${hostRow!.id}`);
  expect(stored.data?.map((f) => f.name) ?? []).not.toContain(info!.qr_image_path!.split("/").pop());

  // Anggota yang tersisa tidak lagi punya akses.
  await member.goto(`/g/${group.id}`);
  await expect(member.getByText("Belum jadi anggota")).toBeVisible();
  await memberCtx.close();
});
