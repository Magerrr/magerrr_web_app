import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("beranda tampil dalam bahasa Indonesia dengan gaya Meadow", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk untuk buat grup" })).toBeVisible();

  const body = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { background: s.backgroundColor, color: s.color, font: s.fontFamily };
  });
  expect(body.background).toBe("rgb(245, 241, 228)"); // cream-paper
  expect(body.color).toBe("rgb(44, 46, 42)"); // ink-black
  expect(body.font).toMatch(/Inter/i);
});

test("manifest PWA tersedia", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "Magerrr", lang: "id", display: "standalone" });

  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});

test("beranda akun: sapaan + profil, sesi terdekat dari semua grup, lalu semua sesi (MAGERRR-13)", async ({ page }) => {
  const email = uniqueEmail("beranda");
  await signInFast(page, email);
  const a = await createGroupViaApi(page, `Beranda A ${Date.now()}`);
  const b = await createGroupViaApi(page, `Beranda B ${Date.now()}`);
  const wibDate = (days: number) => new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
  // Mulai sesi butuh minimal 2 peserta hadir: host + satu teman per grup.
  const players: Record<string, string[]> = {};
  for (const g of [a, b]) {
    const { data: host } = await admin().from("members").select("id").eq("group_id", g.id).single();
    const friend = (await (await page.request.post(`/api/groups/${g.id}/members`, { data: { displayName: "Teman" } })).json()).id as string;
    players[g.id] = [host!.id, friend];
  }
  const session = async (groupId: string, date: string, venue: string, status?: "running" | "finished") => {
    const res = await page.request.post(`/api/groups/${groupId}/sessions`, {
      data: { date, time: "19:00", durationMin: 120, venue, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: players[groupId], costs: { courtPerHour: null, shuttle: null } },
    });
    expect(res.status()).toBe(201);
    const id = (await res.json()).id as string;
    for (const to of status === "finished" ? ["running", "finished"] : status ? [status] : []) {
      expect((await page.request.post(`/api/groups/${groupId}/sessions/${id}/status`, { data: { status: to } })).status()).toBe(200);
    }
  };
  await session(a.id, wibDate(7), "GOR Minggu Depan");
  await session(b.id, wibDate(1), "GOR Besok");
  await session(a.id, wibDate(0), "GOR Berlangsung", "running");
  await session(b.id, "2026-10-01", "GOR Selesai", "finished");
  await session(a.id, "2026-10-02", "GOR Terlewat");

  await page.goto("/");
  await expect(page.getByText(/^Selamat (pagi|siang|sore|malam),$/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(email.split("@")[0]);

  // Paling atas: tumpukan kartu (MAGERRR-15) — berlangsung, lalu rencana terdekat; selesai & yang sudah lewat tidak tampil.
  const stack = page.getByTestId("session-stack");
  await expect(stack.getByTestId("featured-session")).toHaveText([/Beranda A.*GOR Berlangsung/, /Beranda B.*GOR Besok/, /Beranda A.*GOR Minggu Depan/]);
  await expect(stack.locator('[data-depth="0"]')).toContainText("Berlangsung");
  await expect(page.getByTestId("stack-position")).toHaveText("Sesi 1 dari 3");
  await expect(page.getByRole("button", { name: "Sesi berikutnya" })).toHaveCount(0);
  // Geser kiri → kartu berikutnya.
  const box = (await stack.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + 44, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("stack-position")).toHaveText("Sesi 2 dari 3");
  await expect(stack.locator('[data-depth="0"]')).toContainText("GOR Besok");
  // Keyboard: fokus tumpukan, panah kiri → kembali.
  await page.getByRole("group", { name: /Sesi terdekat/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(stack.locator('[data-depth="0"]')).toContainText("GOR Berlangsung");
  await expect(page.getByText("GOR Selesai")).toHaveCount(0);

  // Profil dari app bar.
  await page.getByRole("link", { name: "Profil kamu" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await page.goBack();

  // Semua sesi: berlangsung & akan datang, lalu riwayat (terbaru dulu).
  await page.getByRole("link", { name: "Lihat semua sesi" }).click();
  await expect(page).toHaveURL(/\/sesi$/);
  await expect(page.getByTestId("sessions-akan-datang").getByTestId("session-item")).toHaveText([/GOR Berlangsung/, /GOR Besok/, /GOR Minggu Depan/]);
  await expect(page.getByTestId("sessions-riwayat").getByTestId("session-item")).toHaveText([/Beranda A.*GOR Terlewat/, /Beranda B.*GOR Selesai/]);
  await page.getByTestId("sessions-riwayat").getByText("GOR Selesai").click();
  await expect(page).toHaveURL(new RegExp(`/g/${b.id}/sesi/`));
});
