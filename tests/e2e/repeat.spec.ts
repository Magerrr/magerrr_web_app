import { expect, test } from "@playwright/test";
import { nextWeeklyDate, toJakartaParts } from "../../src/lib/time";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("duplikat sesi untuk minggu depan: detail, peserta, dan biaya terisi (S5)", async ({ page }) => {
  await signInFast(page, uniqueEmail("ulang"));
  const group = await createGroupViaApi(page, "Grup Ulang");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id];
  for (const name of ["p2", "p3", "p4"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: {
      date: "2026-10-09",
      time: "20:00",
      durationMin: 90,
      venue: "GOR Ulang",
      courtCount: 2,
      playMode: "rotasi",
      rules: null,
      matchGames: null,
      note: "Bawa raket cadangan",
      attendeeIds: ids.slice(0, 3),
      costs: { courtPerHour: 60000, shuttle: 30000 },
    },
  });
  const sourceId = (await created.json()).id as string;

  await page.goto(`/g/${group.id}/sesi/${sourceId}`);
  await page.getByRole("link", { name: "Duplikat untuk minggu depan" }).click();
  await expect(page.getByRole("heading", { name: "Duplikat sesi", level: 1 })).toBeVisible();
  const expectedDate = nextWeeklyDate("2026-10-09", toJakartaParts(new Date()).date);
  await expect(page.getByLabel("Tanggal")).toHaveValue(expectedDate);
  await expect(page.getByLabel("Jam mulai")).toHaveValue("20:00");
  await expect(page.getByLabel("Durasi sewa")).toHaveValue("90");
  await expect(page.getByLabel("Tempat")).toHaveValue("GOR Ulang");
  await expect(page.getByRole("radio", { name: /Rotasi/ })).toBeChecked();
  await expect(page.getByLabel("Sewa per lapangan per jam (Rp)")).toHaveValue("60000");
  await expect(page.getByLabel("Biaya kok (Rp)")).toHaveValue("30000");
  await expect(page.getByLabel("Catatan (opsional)")).toHaveValue("Bawa raket cadangan");
  await expect(page.getByText("3 hadir")).toBeVisible();

  await page.getByRole("button", { name: "Simpan sesi" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${group.id}/sesi/[0-9a-f-]{36}$`));
  const copyId = page.url().split("/").pop()!;
  expect(copyId).not.toBe(sourceId);
  const { data: copy } = await admin().from("sessions").select("starts_at, court_count, duration_min, venue, play_mode, note").eq("id", copyId).single();
  expect(copy).toMatchObject({ court_count: 2, duration_min: 90, venue: "GOR Ulang", play_mode: "rotasi", note: "Bawa raket cadangan" });
  expect(toJakartaParts(new Date(copy!.starts_at))).toEqual({ date: expectedDate, time: "20:00" });
  const { data: expenses } = await admin().from("expenses").select("name, amount").eq("session_id", copyId).order("amount");
  // Sewa 60.000 × 2 lapangan × 1,5 jam = 180.000
  expect(expenses).toEqual([
    { name: "Kok", amount: 30000 },
    { name: "Sewa lapangan", amount: 180000 },
  ]);
  const { data: present } = await admin().from("attendees").select("member_id").eq("session_id", copyId).eq("present", true);
  expect(new Set(present!.map((p) => p.member_id))).toEqual(new Set(ids.slice(0, 3)));
});
