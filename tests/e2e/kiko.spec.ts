import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("Kiko: XP & level dari match, streak mingguan, kostum terkunci per level, tampil di profil", async ({ page }) => {
  await signInFast(page, uniqueEmail("kiko"));
  const group = await createGroupViaApi(page, "Grup Kiko");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids: Record<string, string> = { p1: hostRow!.id };
  for (const name of ["p2", "p3", "p4"]) ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;

  // Sesi hari ini (WIB) agar streak minggu ini = 1.
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: today, time: "06:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: Object.values(ids), costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  // Test vector §2: p1 menang 2 dari 3.
  for (const [A, B, a, b] of [
    [["p1", "p2"], ["p3", "p4"], 21, 15],
    [["p1", "p3"], ["p2", "p4"], 21, 19],
    [["p1", "p4"], ["p2", "p3"], 18, 21],
  ] as const) {
    expect((await page.request.post(`${api}/matches`, { data: { kind: "doubles", courtNo: null, A: A.map((p) => ids[p]), B: B.map((p) => ids[p]), games: [{ a, b }] } })).status()).toBe(201);
  }

  // XP = 100 (1 sesi) + 3 × 10 (match) + 2 × 10 (menang) = 150.
  await page.goto(`/g/${group.id}/kiko`);
  await expect(page.getByTestId("kiko-xp")).toContainText("Menuju Lv 2 · Kucing Muda");
  await expect(page.getByTestId("kiko-xp")).toContainText("150 / 500 XP");
  await expect(page.getByTestId("kiko-xp")).toContainText("1 sesi · 3 match · 2 menang");
  await expect(page.getByTestId("kiko-streak")).toContainText("Streak 1 minggu");
  await expect(page.getByTestId("kiko-bubble")).toContainText("Streak 1 minggu!");
  await expect(page.getByRole("img", { name: "Kiko, Lv 1 Anak Kucing" })).toBeVisible();

  // Elus → Kiko membalas.
  await page.getByRole("button", { name: "Elus Kiko" }).click();
  await expect(page.getByTestId("kiko-bubble")).toContainText("Purr");

  // Kostum: Lv 1 hanya warna bulu; yang lain terkunci.
  const wardrobe = page.getByTestId("kiko-wardrobe");
  await expect(wardrobe.getByRole("radio", { name: /Mahkota/ })).toBeDisabled();
  await expect(wardrobe.getByRole("radio", { name: /Ikat kepala/ })).toBeDisabled();
  await wardrobe.getByText("Hitam", { exact: true }).first().click();
  await wardrobe.getByRole("button", { name: "Simpan kostum" }).click();
  await expect(wardrobe.getByText("Kostum Kiko disimpan.")).toBeVisible();
  const saved = async () => (await admin().from("members").select("kiko").eq("id", ids.p1).single()).data!.kiko;
  expect(await saved()).toEqual({ fur: "hitam", hat: "none", acc: "none", jersey: "none" });

  // Server menolak pilihan yang belum terbuka; null = kembali otomatis.
  const put = (outfit: unknown) => page.request.put(`/api/groups/${group.id}/kiko`, { data: { outfit } });
  expect((await put({ fur: "abu", hat: "crown", acc: "none", jersey: "none" })).status()).toBe(422);
  expect((await put({ fur: "ungu", hat: "none", acc: "none", jersey: "none" })).status()).toBe(400);
  expect((await put(null)).status()).toBe(200);
  expect(await saved()).toBeNull();

  // Profil pemain menampilkan Kiko anggota itu.
  // p4 kalah tiga kali: 100 + 3 × 10 = 130.
  await page.goto(`/g/${group.id}/anggota/${ids.p4}`);
  await expect(page.getByTestId("profile-kiko")).toContainText("Kiko · Lv 1 Anak Kucing");
  await expect(page.getByTestId("profile-kiko")).toContainText("130 XP · streak 1 minggu");
  await expect(page.getByTestId("profile-kiko").getByRole("link", { name: "Atur kostum Kiko" })).toHaveCount(0);
});
