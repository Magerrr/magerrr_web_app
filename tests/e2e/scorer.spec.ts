import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("pencatat skor: pemain mengajukan diri, hanya satu yang memegang, admin bisa ambil alih (ALGORITHMS §1d)", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("scorer"));
  const group = await createGroupViaApi(page, "Grup Pencatat");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();

  // Dua tamu bergabung lewat undangan (punya cookie sendiri).
  const join = async (name: string) => {
    const ctx = await browser.newContext({ baseURL });
    const res = await ctx.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: name } });
    expect(res.status()).toBe(201);
    return { ctx, id: (await res.json()).memberId as string };
  };
  const budi = await join("Budi");
  const cici = await join("Cici");
  const { data: rows } = await admin().from("members").select("id, display_name").eq("group_id", group.id);
  const id = (name: string) => rows!.find((r) => r.display_name === name)!.id;
  const p4 = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: "Dodi" } })).json()).id as string;
  const ids = [hostRow!.id, id("Budi"), id("Cici"), p4];

  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Pencatat", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  const started = await page.request.post(`${api}/matches/start`, {
    data: { matches: [{ courtNo: 1, kind: "doubles", A: [ids[0], ids[1]], B: [ids[2], ids[3]] }], seed: 1, queue: null },
  });
  const [matchId] = (await started.json()).ids as string[];
  const score = (ctx: { request: typeof page.request }, a: number, b: number) => ctx.request.put(`${api}/matches/${matchId}/score`, { data: { games: [{ a, b }] } });

  // Tanpa pencatat: hanya admin.
  expect((await score(budi.ctx, 1, 0)).status()).toBe(403);
  expect((await score(page, 1, 0)).status()).toBe(200);

  // Budi mengajukan diri lewat papan skor.
  const board = await budi.ctx.newPage();
  await board.goto(`/g/${group.id}/sesi/${sessionId}/main`);
  await expect(board.getByTestId("scorer-1")).toContainText("Pencatat skor: Admin");
  await board.getByRole("button", { name: "Ajukan jadi pencatat skor" }).click();
  await expect(board.getByTestId("scorer-1")).toContainText("Pencatat skor: Kamu");
  await board.getByRole("button", { name: /Tambah poin Admin|Tambah poin .* \/ Budi/ }).click();
  await expect(board.getByTestId("score-A")).toHaveText("2");
  // Yang mencetak poin servis berikutnya; skor genap → petak kanan.
  await expect(board.getByTestId("serve-A")).toHaveText("Servis kanan");
  await board.getByRole("button", { name: "Pindah servis" }).click();
  await expect(board.getByTestId("serve-B")).toHaveText("Servis kanan");
  await board.getByRole("button", { name: "Undo" }).click();
  await expect(board.getByTestId("serve-A")).toHaveText("Servis kanan");
  await expect(board.getByTestId("sync-status")).toHaveText("Tersimpan");
  // Pemain pencatat tidak bisa membatalkan match.
  await expect(board.getByRole("button", { name: "Batalkan match" })).toHaveCount(0);

  // Hanya satu pencatat: admin & pemain lain ditolak; Cici tidak bisa merebut.
  expect((await score(page, 5, 0)).status()).toBe(403);
  expect((await score(cici.ctx, 5, 0)).status()).toBe(403);
  const grab = await cici.ctx.request.put(`${api}/courts/1/scorer`, { data: { memberId: id("Cici") } });
  expect(grab.status()).toBe(409);
  expect((await cici.ctx.request.put(`${api}/courts/1/scorer`, { data: { memberId: null } })).status()).toBe(403);

  // Admin melihat pencatat dan mengambil alih.
  await page.goto(`/g/${group.id}/sesi/${sessionId}/main`);
  await expect(page.getByLabel("Pencatat skor lapangan 1")).toHaveValue(id("Budi"));
  await expect(page.getByTestId("court-1")).toContainText("2–0");
  await page.getByRole("button", { name: "Ambil alih" }).click();
  await expect(page.getByLabel("Pencatat skor lapangan 1")).toHaveValue("");
  await expect(page.getByTestId("score-A")).toHaveText("2");
  expect((await score(budi.ctx, 3, 0)).status()).toBe(403);

  // Admin menunjuk Cici lewat pilihan.
  await page.getByLabel("Pencatat skor lapangan 1").selectOption(id("Cici"));
  await expect(page.getByRole("button", { name: "Ambil alih" })).toBeVisible();
  expect((await score(cici.ctx, 3, 0)).status()).toBe(200);
  expect((await cici.ctx.request.post(`${api}/matches/${matchId}/complete`, { data: { games: [{ a: 21, b: 10 }] } })).status()).toBe(200);
  const { data: audit } = await admin().from("audit_log").select("actor_member_id").eq("entity_id", matchId);
  expect(audit!.map((r) => r.actor_member_id)).toEqual([id("Cici")]);

  await budi.ctx.close();
  await cici.ctx.close();
});

test("papan skor layar penuh & visual lapangan di skor langsung", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("layar"));
  const group = await createGroupViaApi(page, "Grup Layar");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id];
  for (const name of ["Budi", "Cici", "Dodi"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Layar", courtCount: 2, playMode: "kocok", rules: null, matchGames: 3, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  const { data: token } = await admin().from("sessions").select("share_token").eq("id", sessionId).single();
  const layar = `/s/${token!.share_token}/layar`;

  const tv = await (await browser.newContext({ baseURL })).newPage();
  await tv.goto(layar);
  await expect(tv.getByText("Sesi belum dimulai.")).toBeVisible();

  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  const started = await page.request.post(`${api}/matches/start`, {
    data: { matches: [{ courtNo: 1, kind: "doubles", A: [ids[0], ids[1]], B: [ids[2], ids[3]] }], seed: 1, queue: null },
  });
  const [matchId] = (await started.json()).ids as string[];

  await tv.goto(`${layar}?lapangan=1`);
  const court = tv.getByTestId("display-court-1");
  await expect(court.getByRole("heading", { name: "Lapangan 1" })).toBeVisible();
  await expect(court.getByTestId("display-team-A")).toContainText("Budi");
  await expect(court.getByTestId("display-team-B")).toContainText("Cici");
  await expect(court.getByTestId("display-team-B")).toContainText("Dodi");
  await expect(court.getByTestId("display-serve")).toHaveCount(0);
  await expect(tv.getByTestId("display-court-2")).toHaveCount(0);

  // Skor & posisi kok (B servis dengan skor ganjil → petak kiri) ikut berubah tanpa memuat ulang.
  expect((await page.request.put(`${api}/matches/${matchId}/score`, { data: { games: [{ a: 21, b: 15 }, { a: 3, b: 7 }], serving: "B" } })).status()).toBe(200);
  await expect(court.getByTestId("display-team-B").getByTestId("display-score-B")).toHaveText("7", { timeout: 10_000 });
  await expect(court.getByTestId("display-team-A").getByTestId("display-score-A")).toHaveText("3");
  await expect(court.getByTestId("display-team-B").getByTestId("display-serve")).toHaveText("Servis kiri");

  // Skor langsung biasa: lapangan (game 2 → B di kiri) dan posisi kok.
  await tv.goto(`/s/${token!.share_token}/skor`);
  await expect(tv.getByTestId("live-court-1").getByRole("img", { name: /kiri (Cici dan Dodi|Dodi dan Cici)/ })).toBeVisible();
  await expect(tv.getByTestId("live-serve")).toHaveText("Servis kiri");
  await expect(tv.getByRole("link", { name: /Papan skor layar penuh/ })).toHaveAttribute("href", layar);
  await tv.context().close();
});
