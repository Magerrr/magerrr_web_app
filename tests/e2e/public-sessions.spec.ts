import { expect, test, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

/** Tanggal besok (WIB) agar sesi selalu belum lewat. */
const tomorrow = () => new Date(Date.now() + 36 * 3600_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

async function createPlannedSession(page: Page, groupId: string, hostId: string) {
  const created = await page.request.post(`/api/groups/${groupId}/sessions`, {
    data: { date: tomorrow(), time: "19:00", durationMin: 120, venue: "GOR Publik", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: [hostId], costs: { courtPerHour: 80000, shuttle: null } },
  });
  expect(created.status()).toBe(201);
  return (await created.json()).id as string;
}

test("ikut sesi publik: pengunjung jadi anggota + peserta, anggota existing hanya RSVP, grup privat 404 (#15)", async ({ page, browser, baseURL }) => {
  await signInFast(page, uniqueEmail("sesipublik"));
  const group = await createGroupViaApi(page, `Sesi Publik ${Date.now()}`);
  const { data: host } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const sessionId = await createPlannedSession(page, group.id, host!.id);
  const ikut = `/api/jelajah/sesi/${sessionId}/ikut`;
  const members = async () => (await admin().from("members").select("id, display_name, user_id").eq("group_id", group.id)).data!;
  const rsvpOf = async (memberId: string) =>
    (await admin().from("attendees").select("rsvp").eq("session_id", sessionId).eq("member_id", memberId).maybeSingle()).data?.rsvp;

  // Grup privat (bawaan): sesi tidak bisa diikuti dan keberadaannya tidak bocor.
  const outsiderCtx = await browser.newContext({ baseURL });
  expect((await outsiderCtx.request.post(ikut, { data: { displayName: "Luar" } })).status()).toBe(404);
  expect((await outsiderCtx.request.post("/api/jelajah/sesi/bukan-uuid/ikut", { data: { displayName: "Luar" } })).status()).toBe(404);
  expect(await members()).toHaveLength(1);

  // Admin menjadikan grup publik.
  expect((await page.request.patch(`/api/groups/${group.id}`, { data: { isPublic: true } })).status()).toBe(200);

  // Tamu: jadi anggota (tanpa akun) + peserta (RSVP going).
  const guestCtx = await browser.newContext({ baseURL });
  const guestRes = await guestCtx.request.post(ikut, { data: { displayName: "Tamu Sesi" }, maxRedirects: 0 });
  expect(guestRes.status()).toBe(303);
  expect(guestRes.headers().location).toBe(`/g/${group.id}/sesi/${sessionId}`);
  const guestRow = (await members()).find((m) => m.display_name === "Tamu Sesi");
  expect(guestRow?.user_id).toBeNull();
  expect(await rsvpOf(guestRow!.id)).toBe("going");

  // Akun baru: jadi anggota + peserta; kali kedua (sudah anggota) hanya RSVP, anggota tidak bertambah.
  const userCtx = await browser.newContext({ baseURL });
  const user = await userCtx.newPage();
  await signInFast(user, uniqueEmail("pengikut"));
  expect((await user.request.post(ikut, { data: { displayName: "Akun Sesi" }, maxRedirects: 0 })).status()).toBe(303);
  const afterFirst = await members();
  const accountRow = afterFirst.find((m) => m.display_name === "Akun Sesi");
  expect(accountRow?.user_id).not.toBeNull();
  expect(await rsvpOf(accountRow!.id)).toBe("going");

  await admin().from("attendees").update({ rsvp: "maybe" }).eq("session_id", sessionId).eq("member_id", accountRow!.id);
  expect((await user.request.post(ikut, { data: { displayName: "Nama Lain" }, maxRedirects: 0 })).status()).toBe(303);
  expect(await members()).toHaveLength(afterFirst.length);
  expect(await rsvpOf(accountRow!.id)).toBe("going");

  // Kembali privat: pengunjung baru tidak lagi bisa mengikuti sesi.
  expect((await page.request.patch(`/api/groups/${group.id}`, { data: { isPublic: false } })).status()).toBe(200);
  expect((await outsiderCtx.request.post(ikut, { data: { displayName: "Telat" } })).status()).toBe(404);

  await outsiderCtx.close();
  await guestCtx.close();
  await userCtx.close();
});

test("sesi disembunyikan host (is_listed=false): otomatis terlihat lebih dulu, perubahan tercatat di audit (#15)", async ({ page }) => {
  await signInFast(page, uniqueEmail("sembunyi"));
  const group = await createGroupViaApi(page, `Sembunyi ${Date.now()}`);
  const { data: host } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const sessionId = await createPlannedSession(page, group.id, host!.id);
  const listed = async () => (await admin().from("sessions").select("is_listed").eq("id", sessionId).single()).data!.is_listed;

  expect(await listed()).toBe(true);
  await admin().from("sessions").update({ is_listed: false }).eq("id", sessionId);
  expect(await listed()).toBe(false);
  const { data: audit } = await admin().from("audit_log").select("after").eq("entity", "session_listed").eq("entity_id", sessionId);
  expect(audit?.map((a) => a.after)).toContainEqual({ is_listed: false });
});
