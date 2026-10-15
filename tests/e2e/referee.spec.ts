import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("wasit mengurus permainan (kocok, skor, batal, catat manual) tapi bukan pengaturan, sesi, patungan, atau kok", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("host"));
  const group = await createGroupViaApi(page, "Grup Wasit");
  const api = `/api/groups/${group.id}`;
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();

  // Calon wasit (akun) dan tamu bergabung.
  const refCtx = await browser.newContext({ baseURL });
  const ref = await refCtx.newPage();
  await signInFast(ref, uniqueEmail("wasit"));
  expect((await ref.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Wawan" } })).status()).toBe(201);
  const guestCtx = await browser.newContext({ baseURL });
  const guestJoin = await guestCtx.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Tamu" } });
  const guestId = (await guestJoin.json()).memberId as string;
  const { data: refRow } = await admin().from("members").select("id").eq("group_id", group.id).eq("display_name", "Wawan").single();
  const extra = (await (await page.request.post(`${api}/members`, { data: { displayName: "Dodi" } })).json()).id as string;

  const extra2 = (await (await page.request.post(`${api}/members`, { data: { displayName: "Eka" } })).json()).id as string;

  // Sesi yang belum dimulai memuat Wawan sebagai peserta; jadi wasit mengeluarkannya (tidak ikut main).
  const before = await page.request.post(`${api}/sessions`, {
    data: { date: "2026-10-16", time: "19:00", durationMin: 120, venue: "GOR Awal", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: [hostRow!.id, refRow!.id], costs: { courtPerHour: 40000, shuttle: null } },
  });
  const beforeId = (await before.json()).id as string;
  const presentIn = async (sid: string, mid: string) =>
    (await admin().from("attendees").select("present").eq("session_id", sid).eq("member_id", mid).maybeSingle()).data?.present ?? false;
  expect(await presentIn(beforeId, refRow!.id)).toBe(true);

  // Admin menjadikan Wawan wasit lewat UI; tamu tidak bisa jadi wasit.
  await page.goto(`/g/${group.id}/anggota`);
  const wawan = page.getByTestId("member-row").filter({ hasText: "Wawan" });
  await wawan.getByLabel("Peran").selectOption("referee");
  await expect.poll(async () => (await admin().from("members").select("role").eq("id", refRow!.id).single()).data?.role).toBe("referee");
  await expect(wawan.getByLabel("Peran")).toHaveValue("referee");
  await expect.poll(() => presentIn(beforeId, refRow!.id)).toBe(false);
  expect(await presentIn(beforeId, hostRow!.id)).toBe(true);
  expect((await page.request.patch(`${api}/members/${guestId}`, { data: { role: "referee" } })).status()).toBe(422);
  // Wasit tidak bisa mengubah peran.
  expect((await ref.request.patch(`${api}/members/${extra}`, { data: { role: "referee" } })).status()).toBe(403);

  const ids = [hostRow!.id, guestId, extra, extra2];
  const created = await page.request.post(`${api}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Wasit", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: 40000, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const s = `${api}/sessions/${sessionId}`;

  // Wasit tidak ikut bermain: tidak bisa jadi peserta, tidak ada RSVP, dan tidak muncul di pilihan peserta.
  const asPlayer = await page.request.post(`${api}/sessions`, {
    data: { date: "2026-10-17", time: "19:00", durationMin: 120, venue: "GOR Wasit", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: [refRow!.id], costs: { courtPerHour: null, shuttle: null } },
  });
  expect(asPlayer.status()).toBe(422);
  expect((await page.request.put(`${s}/attendees`, { data: { memberIds: [...ids, refRow!.id] } })).status()).toBe(422);
  expect((await ref.request.put(`${s}/rsvp`, { data: { rsvp: "going" } })).status()).toBe(422);
  await page.goto(`/g/${group.id}/sesi/baru`);
  await expect(page.getByText("Wawan")).toHaveCount(0);
  await expect(page.getByText("Dodi")).toBeVisible();

  // Bukan urusan wasit → 403.
  expect((await ref.request.patch(api, { data: { name: "Ganti" } })).status()).toBe(403);
  expect((await ref.request.post(`${api}/sessions`, { data: {} })).status()).toBe(403);
  expect((await ref.request.post(`${s}/status`, { data: { status: "running" } })).status()).toBe(403);
  expect((await ref.request.put(`${s}/shuttle`, { data: { pricePerSlop: null, perSlop: 12, used: 1 } })).status()).toBe(403);
  expect((await ref.request.post(`${s}/expenses`, { data: { name: "x", amount: 1, paidBy: refRow!.id, preset: null, split: { mode: "all" } } })).status()).toBe(403);
  // Tamu/pemain biasa tetap tidak bisa kocok.
  expect((await guestCtx.request.post(`${s}/plan`, { data: { kind: "doubles", seed: 1 } })).status()).toBe(403);

  expect((await page.request.post(`${s}/status`, { data: { status: "running" } })).status()).toBe(200);

  // Wasit mengocok dan memulai ronde lewat papan skor, tanpa kartu kok.
  await ref.goto(`/g/${group.id}/sesi/${sessionId}/main`);
  await expect(ref.getByRole("heading", { name: "Kok" })).toHaveCount(0);
  await ref.getByRole("button", { name: "Kocok ronde" }).click();
  await expect(ref.getByTestId("proposal-court-1")).toBeVisible();
  await ref.getByRole("button", { name: "Mulai main" }).click();
  await expect(ref.getByTestId("score-A")).toHaveText("0");

  // Wasit mencatat skor lapangan tanpa pencatat, lalu membatalkan match.
  const { data: running } = await admin().from("matches").select("id").eq("session_id", sessionId).eq("status", "running").single();
  expect((await ref.request.put(`${s}/matches/${running!.id}/score`, { data: { games: [{ a: 3, b: 1 }] } })).status()).toBe(200);
  expect((await guestCtx.request.put(`${s}/matches/${running!.id}/score`, { data: { games: [{ a: 4, b: 1 }] } })).status()).toBe(403);
  expect((await ref.request.post(`${s}/matches/${running!.id}/void`)).status()).toBe(200);

  // Catat manual terbuka untuk wasit; ditolak untuk tamu.
  await ref.goto(`/g/${group.id}/sesi/${sessionId}/catat`);
  await expect(ref.getByRole("heading", { level: 1, name: "Catat match" })).toBeVisible();
  const manual = await ref.request.post(`${s}/matches`, {
    data: { kind: "doubles", A: [ids[0], ids[1]], B: [ids[2], ids[3]], games: [{ a: 21, b: 15 }], courtNo: null },
  });
  expect(manual.status()).toBe(201);
  const { data: audit } = await admin().from("audit_log").select("actor_member_id").eq("group_id", group.id).eq("entity", "match").order("at", { ascending: false }).limit(1).single();
  expect(audit!.actor_member_id).toBe(refRow!.id);

  // Pengaturan grup tetap tertutup untuk wasit.
  await ref.goto(`/g/${group.id}/pengaturan`);
  await expect(ref.getByText("Khusus admin")).toBeVisible();

  await refCtx.close();
  await guestCtx.close();
});
