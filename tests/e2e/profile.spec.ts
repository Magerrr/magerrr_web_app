import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("form & streak (L6), head-to-head (L7), profil pemain dengan riwayat & tagihan (X2)", async ({ page }) => {
  await signInFast(page, uniqueEmail("profil"));
  const group = await createGroupViaApi(page, "Grup Profil");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids: Record<string, string> = { p1: hostRow!.id };
  for (const name of ["p2", "p3", "p4"]) ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Profil", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: Object.values(ids), costs: { courtPerHour: 35000, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  // Vector §2 lalu dua match lagi (urutan = seq di sesi).
  for (const [A, B, a, b] of [
    [["p1", "p2"], ["p3", "p4"], 21, 15],
    [["p1", "p3"], ["p2", "p4"], 21, 19],
    [["p1", "p4"], ["p2", "p3"], 18, 21],
    [["p2", "p4"], ["p1", "p3"], 21, 10],
    [["p2", "p1"], ["p3", "p4"], 21, 17],
  ] as const) {
    const saved = await page.request.post(`${api}/matches`, { data: { kind: "doubles", courtNo: null, A: A.map((p) => ids[p]), B: B.map((p) => ids[p]), games: [{ a, b }] } });
    expect(saved.status()).toBe(201);
  }

  // Tab Form: chips terbaru di kiri, streak berjalan >= 2.
  await page.goto(`/g/${group.id}/leaderboard?tab=form&periode=semua`);
  const row = (id: string) => page.locator(`[data-testid=form-row][data-member="${id}"]`);
  await expect(row(ids.p1).getByTestId("form-chips").locator("li")).toHaveText(["M", "K", "K", "M", "M"]);
  await expect(row(ids.p2).getByTestId("streak")).toHaveText("Menang 3× beruntun");
  await expect(row(ids.p3).getByTestId("streak")).toHaveText("Kalah 2× beruntun");
  await expect(row(ids.p1).getByTestId("streak")).toHaveCount(0);

  // Dari klasemen ke profil p2.
  await page.goto(`/g/${group.id}/leaderboard?periode=semua`);
  await page.getByTestId("standings").getByRole("link", { name: "p2" }).click();
  await expect(page.getByRole("heading", { name: "p2", level: 1 })).toBeVisible();
  await expect(page.getByTestId("profile-stats")).toContainText("#1");
  await expect(page.getByTestId("form").locator("li")).toHaveText(["M", "M", "M", "K", "M"]);
  await expect(page.getByTestId("streak")).toContainText("Menang 3 kali beruntun saat ini");
  await expect(page.getByTestId("profile-history").locator("li")).toHaveCount(5);

  // Head-to-head: pilih p1 → p2 menang 2 dari 3 pertemuan (m3 21–18, n1 21–10; kalah m2 19–21).
  await page.getByLabel("Lawan").selectOption({ value: `/g/${group.id}/anggota/${ids.p2}?lawan=${ids.p1}` });
  await expect(page).toHaveURL(new RegExp(`lawan=${ids.p1}`));
  await expect(page.getByTestId("h2h")).toContainText("2–1");
  await expect(page.getByTestId("h2h")).toContainText("dalam 3 pertemuan · poin 61–49");

  // Tagihan lintas sesi: 70.000 / 4 = 17.500 ke host.
  await expect(page.getByTestId("balance")).toHaveText("Belum dibayar Rp17.500");

  // Daftar anggota menaut ke profil.
  await page.goto(`/g/${group.id}/anggota`);
  await page.getByRole("link", { name: "p3" }).click();
  await expect(page.getByRole("heading", { name: "p3", level: 1 })).toBeVisible();
  await page.goto(`/g/${group.id}/anggota/${"0".repeat(8)}-0000-4000-8000-000000000000`);
  await expect(page.getByText("Anggota tidak ditemukan")).toBeVisible();
});
