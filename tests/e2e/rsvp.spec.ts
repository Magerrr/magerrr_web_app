import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("RSVP: tamu & admin menjawab lewat halaman sesi; admin menjadikan yang ikut peserta (S3)", async ({ page, browser, baseURL }) => {
  page.on("dialog", (d) => d.accept());
  await signInFast(page, uniqueEmail("rsvp"));
  const group = await createGroupViaApi(page, "Grup RSVP");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-16", time: "19:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: [hostRow!.id], costs: { courtPerHour: 80000, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const sessionPath = `/g/${group.id}/sesi/${sessionId}`;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;

  // Tamu bergabung lewat undangan lalu membuka tautan sesi.
  const guestCtx = await browser.newContext({ baseURL });
  const guest = await guestCtx.newPage();
  await guest.goto(`/gabung/${group.inviteCode}`);
  await guest.getByLabel("Nama panggilan").fill("Budi");
  await guest.getByRole("button", { name: "Gabung grup" }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${group.id}$`));
  await guest.goto(sessionPath);
  const rsvp = guest.getByTestId("rsvp");
  await rsvp.getByRole("button", { name: "Ikut", exact: true }).click();
  await expect(rsvp.getByRole("button", { name: "Ikut", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(guest.getByTestId("rsvp-summary")).toContainText("Ikut (1)Budi");
  await rsvp.getByRole("button", { name: "Tidak ikut" }).click();
  await expect(guest.getByTestId("rsvp-summary")).toContainText("Tidak ikut (1)Budi");
  await rsvp.getByRole("button", { name: "Ikut", exact: true }).click();
  await expect(guest.getByTestId("rsvp-summary")).toContainText("Ikut (1)Budi");
  // Tamu tidak bisa mengubah kehadiran.
  await expect(guest.getByRole("button", { name: "Jadikan yang ikut sebagai peserta" })).toHaveCount(0);

  const { data: budi } = await admin().from("members").select("id").eq("group_id", group.id).eq("display_name", "Budi").single();
  const attendee = async (id: string) => (await admin().from("attendees").select("rsvp, present").eq("session_id", sessionId).eq("member_id", id).single()).data;
  // RSVP sendiri tidak mengubah kehadiran.
  expect(await attendee(budi!.id)).toEqual({ rsvp: "going", present: false });

  // Admin menjawab "Mungkin", lalu menjadikan yang ikut sebagai peserta.
  await page.goto(sessionPath);
  await page.getByTestId("rsvp").getByRole("button", { name: "Mungkin" }).click();
  await expect(page.getByTestId("rsvp-summary")).toContainText("Mungkin (1)");
  await page.getByRole("button", { name: "Jadikan yang ikut sebagai peserta" }).click();
  await expect.poll(() => attendee(budi!.id)).toEqual({ rsvp: "going", present: true });
  expect(await attendee(hostRow!.id)).toEqual({ rsvp: "maybe", present: false });
  await page.reload();
  await expect(page.getByText("1 hadir", { exact: true })).toBeVisible();

  // Pengunjung tak dikenal → 401; sesi selesai → 422.
  const stranger = await browser.newContext({ baseURL });
  expect((await stranger.request.put(`${api}/rsvp`, { data: { rsvp: "going" } })).status()).toBe(401);
  await stranger.close();
  expect((await page.request.put(`${api}/attendees`, { data: { memberIds: [hostRow!.id, budi!.id] } })).status()).toBe(200);
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  expect((await page.request.post(`${api}/status`, { data: { status: "finished" } })).status()).toBe(200);
  expect((await guestCtx.request.put(`${api}/rsvp`, { data: { rsvp: "not_going" } })).status()).toBe(422);
  await guestCtx.close();
});
