import { expect, test, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

async function session(page: Page, groupId: string, date: string, attendeeIds: string[]) {
  const res = await page.request.post(`/api/groups/${groupId}/sessions`, {
    data: { date, time: "19:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds, costs: { courtPerHour: null, shuttle: null } },
  });
  expect(res.status()).toBe(201);
  const id = (await res.json()).id as string;
  expect((await page.request.post(`/api/groups/${groupId}/sessions/${id}/status`, { data: { status: "running" } })).status()).toBe(200);
  return id;
}

const seasonOf = async (sessionId: string) => (await admin().from("sessions").select("season_id").eq("id", sessionId).single()).data!.season_id;

test("musim: buat, sesi masuk menurut tanggal, tutup → arsip & juara musim (L9)", async ({ page, browser, baseURL }) => {
  page.on("dialog", (d) => d.accept());
  await signInFast(page, uniqueEmail("musim"));
  const group = await createGroupViaApi(page, "Grup Musim");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids: Record<string, string> = { p1: hostRow!.id };
  for (const name of ["p2", "p3", "p4"]) ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;
  const all = Object.values(ids);
  const record = async (sessionId: string, A: string[], B: string[], a: number, b: number) =>
    expect(
      (await page.request.post(`/api/groups/${group.id}/sessions/${sessionId}/matches`, { data: { kind: "doubles", courtNo: null, A: A.map((p) => ids[p]), B: B.map((p) => ids[p]), games: [{ a, b }] } })).status(),
    ).toBe(201);

  // September: vector §2 (juara p2). Oktober: p3/p4 menang.
  const sep = await session(page, group.id, "2026-09-20", all);
  await record(sep, ["p1", "p2"], ["p3", "p4"], 21, 15);
  await record(sep, ["p1", "p3"], ["p2", "p4"], 21, 19);
  await record(sep, ["p1", "p4"], ["p2", "p3"], 18, 21);
  const oct = await session(page, group.id, "2026-10-05", all);
  await record(oct, ["p3", "p4"], ["p1", "p2"], 21, 10);

  // Belum ada musim.
  await page.goto(`/g/${group.id}/leaderboard?periode=musim`);
  await expect(page.getByText("Grup ini belum punya musim.")).toBeVisible();
  await page.getByRole("link", { name: "Mulai musim" }).click();

  // Musim September (1–30 Sep).
  await page.getByLabel("Nama musim").fill("Musim September");
  await page.getByLabel("Mulai").fill("2026-09-01");
  await page.getByLabel("Selesai (opsional)").fill("2026-09-30");
  await page.getByRole("button", { name: "Mulai musim" }).click();
  await expect(page.getByTestId("open-season")).toContainText("Musim September");
  await expect(page.getByTestId("season-leader")).toHaveText("Memimpin: p2 · 6 poin");
  const { data: s1 } = await admin().from("seasons").select("id").eq("group_id", group.id).single();
  expect(await seasonOf(sep)).toBe(s1!.id);
  expect(await seasonOf(oct)).toBeNull();

  // Hanya satu musim berjalan.
  const second = await page.request.post(`/api/groups/${group.id}/seasons`, { data: { name: "Dobel", startsOn: "2026-10-01", endsOn: null } });
  expect(second.status()).toBe(409);
  expect((await page.request.post(`/api/groups/${group.id}/seasons`, { data: { name: "X", startsOn: "2026-10-02", endsOn: "2026-10-01" } })).status()).toBe(400);

  // Tutup → arsip dengan juara.
  await page.getByRole("button", { name: "Tutup musim" }).click();
  await expect(page.getByTestId("season-archive")).toContainText("Musim September");
  await expect(page.getByTestId("season-champion")).toHaveText("Juara: p2 (6 poin)");

  // Musim Oktober (berjalan, tanpa tanggal akhir): sesi Oktober & sesi baru otomatis masuk.
  await page.getByLabel("Nama musim").fill("Musim Oktober");
  await page.getByLabel("Mulai").fill("2026-10-01");
  await page.getByRole("button", { name: "Mulai musim" }).click();
  await expect(page.getByTestId("open-season")).toContainText("Musim Oktober");
  const { data: s2 } = await admin().from("seasons").select("id").eq("group_id", group.id).is("closed_at", null).single();
  expect(await seasonOf(oct)).toBe(s2!.id);
  const later = await session(page, group.id, "2026-10-12", all);
  expect(await seasonOf(later)).toBe(s2!.id);
  expect(await seasonOf(sep)).toBe(s1!.id);

  // Leaderboard periode musim: default musim berjalan; musim lama menampilkan juara.
  await page.goto(`/g/${group.id}/leaderboard?periode=musim`);
  await expect(page.getByTestId("podium-item").first()).toContainText(/p3|p4/);
  await page.goto(`/g/${group.id}/leaderboard?periode=musim&musim=${s1!.id}`);
  await expect(page.getByTestId("season-champion")).toHaveText("Musim September sudah selesai. Juara: p2.");

  // Bukan admin tidak bisa membuat / menutup musim.
  const guest = await browser.newContext({ baseURL });
  expect((await guest.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Penonton" } })).status()).toBe(201);
  expect((await guest.request.post(`/api/groups/${group.id}/seasons`, { data: { name: "Y", startsOn: "2026-11-01", endsOn: null } })).status()).toBe(403);
  expect((await guest.request.patch(`/api/groups/${group.id}/seasons/${s2!.id}`, { data: { action: "close" } })).status()).toBe(403);
  await guest.close();
});
