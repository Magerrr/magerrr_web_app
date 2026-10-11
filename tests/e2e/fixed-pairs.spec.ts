import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("mode pasangan tetap: pasangkan otomatis, 3 ronde lawan berganti, validasi (SC10c)", async ({ page }) => {
  await signInFast(page, uniqueEmail("fix"));
  const group = await createGroupViaApi(page, "Grup Fix");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id];
  for (const name of ["p2", "p3", "p4", "p5", "p6", "p7", "p8"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const grades = ["A", "A", "B", "B", "C", "C", "D", "D"];
  for (const [i, id] of ids.entries()) expect((await page.request.patch(`/api/groups/${group.id}/members/${id}`, { data: { grade: grades[i] } })).status()).toBe(200);
  const outsider = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: "Tidak hadir" } })).json()).id;

  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: null, courtCount: 2, playMode: "fix_pasangan", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  expect(created.status()).toBe(201);
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);

  await page.goto(`/g/${group.id}/sesi/${sessionId}/main`);
  await expect(page.getByTestId("fixed-pairs")).toContainText("Belum ada pasangan.");
  await page.getByRole("button", { name: "Atur ronde" }).click();
  await expect(page.getByText("Atur pasangan tetap dulu.")).toBeVisible();

  await page.getByRole("button", { name: "Pasangkan otomatis" }).click();
  await expect(page.getByTestId("pair-list").locator("li")).toHaveCount(4);
  const pairs = (await admin().from("sessions").select("fixed_pairs").eq("id", sessionId).single()).data!.fixed_pairs as [string, string][];
  expect(new Set(pairs.flat())).toEqual(new Set(ids));
  // Seimbang: tiap pasangan berisi satu grade atas (A/B) dan satu grade bawah (C/D).
  const grade = new Map(ids.map((id, i) => [id, grades[i]]));
  for (const p of pairs) expect(p.map((id) => grade.get(id)!).sort().join("")).toMatch(/^[AB][CD]$/);
  const key = (team: string[]) => [...team].sort().join("|");
  const pairKeys = new Set(pairs.map(key));

  // Tiga ronde lewat UI; selesaikan lewat API.
  const meetings: string[] = [];
  for (let round = 0; round < 3; round++) {
    await page.getByRole("button", { name: "Atur ronde" }).click();
    await expect(page.getByTestId("proposal-court-2")).toBeVisible();
    await page.getByRole("button", { name: "Mulai main" }).click();
    await expect(page.getByTestId("court-1").getByTestId("score-A")).toHaveText("0");
    const { data: running } = await admin().from("matches").select("id, match_players(side, member_id)").eq("session_id", sessionId).eq("status", "running");
    expect(running).toHaveLength(2);
    for (const m of running!) {
      const A = m.match_players.filter((p) => p.side === "A").map((p) => p.member_id);
      const B = m.match_players.filter((p) => p.side === "B").map((p) => p.member_id);
      expect(pairKeys.has(key(A)) && pairKeys.has(key(B))).toBe(true);
      meetings.push([key(A), key(B)].sort().join(" vs "));
      expect((await page.request.post(`${api}/matches/${m.id}/complete`, { data: { games: [{ a: 21, b: 15 }] } })).status()).toBe(200);
    }
    await page.reload();
  }
  // 4 pasangan, 3 ronde: setiap pasangan bertemu tiga pasangan lain tanpa ulangan.
  expect(meetings).toHaveLength(6);
  expect(new Set(meetings).size).toBe(6);

  // Validasi server.
  const start = (A: string[], B: string[]) => page.request.post(`${api}/matches/start`, { data: { matches: [{ courtNo: 1, kind: "doubles", A, B }], seed: 1, queue: null } });
  expect((await start([pairs[0][0], pairs[1][0]], [pairs[0][1], pairs[1][1]])).status()).toBe(422);
  const put = (body: unknown) => page.request.put(`${api}/pairs`, { data: body });
  expect((await put({ pairs: [[ids[0], ids[0]]] })).status()).toBe(422);
  expect((await put({ pairs: [[ids[0], ids[1]], [ids[1], ids[2]]] })).status()).toBe(422);
  expect((await put({ pairs: [[ids[0], outsider]] })).status()).toBe(422);
  const manual = await put({ pairs: [[ids[0], ids[1]], [ids[2], ids[3]]] });
  expect(manual.status()).toBe(200);
  expect((await manual.json()).unpaired).toHaveLength(4);
  expect((await page.request.post(`${api}/plan`, { data: { kind: "singles", seed: 1 } })).status()).toBe(422);
});
