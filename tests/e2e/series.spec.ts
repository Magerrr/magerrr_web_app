import { expect, test } from "@playwright/test";
import { occurrence } from "../../src/lib/core/recurrence";
import { toJakartaParts } from "../../src/lib/time";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("sesi berulang: buat sesi mingguan → sesi berikutnya muncul saat grup dibuka → tidak dobel (S5)", async ({ page }) => {
  await signInFast(page, uniqueEmail("seri"));
  const group = await createGroupViaApi(page, "Grup Seri");
  const { data: host } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const today = toJakartaParts(new Date()).date;

  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: {
      date: today,
      time: "19:00",
      durationMin: 120,
      venue: "GOR Seri",
      courtCount: 2,
      playMode: "kocok",
      rules: null,
      matchGames: null,
      note: null,
      attendeeIds: [host!.id],
      costs: { courtPerHour: 50000, shuttle: null },
      repeat: { frequency: "weekly", monthlyBy: null, ahead: 3 },
    },
  });
  expect(created.status()).toBe(201);
  const firstId = (await created.json()).id as string;
  const { data: first } = await admin().from("sessions").select("template_id").eq("id", firstId).single();
  const series = () => admin().from("sessions").select("id, status, venue, starts_at, template_date").eq("template_id", first!.template_id!).order("template_date");
  const expected = [0, 1, 2].map((k) => occurrence({ frequency: "weekly" }, today, k));

  await page.goto(`/g/${group.id}`);
  await page.reload();
  const rows = (await series()).data!;
  expect(rows.map((r) => r.template_date)).toEqual(expected);
  for (const r of rows) {
    expect(r).toMatchObject({ status: "planned", venue: "GOR Seri" });
    expect(toJakartaParts(new Date(r.starts_at)).time).toBe("19:00");
  }

  // Jeda lalu hentikan dari halaman sesi: sesi yang sudah dibuat tetap ada, audit tercatat.
  await page.goto(`/g/${group.id}/sesi/${firstId}`);
  await expect(page.getByTestId("series-panel")).toContainText("Tiap minggu");
  await page.getByRole("button", { name: "Jeda" }).click();
  await expect(page.getByText("Dijeda")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Hentikan" }).click();
  await expect(page.getByRole("button", { name: "Ulangi sesi ini" })).toBeVisible();
  const { data: kept } = await admin().from("sessions").select("id").in("id", rows.map((r) => r.id));
  expect(kept).toHaveLength(3);
  const { data: audit } = await admin().from("audit_log").select("action").eq("group_id", group.id).eq("entity", "session_template");
  expect(audit!.map((a) => a.action).sort()).toEqual(["create", "delete", "update"]);
});
