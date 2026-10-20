import { expect, test } from "@playwright/test";
import { toJakartaParts } from "../../src/lib/time";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

const CRON = { headers: { authorization: "Bearer e2e-cron-secret" } };

test("jadwal mingguan: buat template → sesi muncul → tidak dobel (S5)", async ({ page }) => {
  await signInFast(page, uniqueEmail("jadwal"));
  const group = await createGroupViaApi(page, "Grup Jadwal");
  const weekday = (new Date(toJakartaParts(new Date()).date + "T00:00:00Z").getUTCDay() + 3) % 7; // 3 hari lagi

  await page.goto(`/g/${group.id}/jadwal`);
  await page.getByLabel("Hari", { exact: true }).selectOption(String(weekday));
  await page.getByLabel("Jam mulai").fill("19:00");
  await page.getByLabel("Jam selesai").fill("21:00");
  await page.getByLabel("Tempat").fill("GOR Jadwal");
  await page.getByLabel("Jumlah lapangan").fill("2");
  await page.getByLabel("Sewa per lapangan per jam (Rp)").fill("50000");
  await page.getByRole("button", { name: "Buat jadwal" }).click();
  await expect(page.getByTestId("template-row")).toContainText("GOR Jadwal");

  const { data: tpl } = await admin().from("session_templates").select("id").eq("group_id", group.id).single();
  const sessions = () => admin().from("sessions").select("id, status, venue, duration_min, starts_at").eq("template_id", tpl!.id);
  expect((await sessions()).data).toEqual([]);

  expect((await page.request.post("/api/cron/session-templates")).status()).toBe(401);
  expect((await page.request.post("/api/cron/session-templates", { headers: { authorization: "Bearer salah" } })).status()).toBe(401);

  expect((await page.request.post("/api/cron/session-templates", CRON)).status()).toBe(200);
  const first = (await sessions()).data!;
  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({ status: "planned", venue: "GOR Jadwal", duration_min: 120 });
  expect(toJakartaParts(new Date(first[0].starts_at)).time).toBe("19:00");

  await page.request.post("/api/cron/session-templates", CRON);
  expect((await sessions()).data).toHaveLength(1);

  // Jeda: tidak membuat sesi baru; hapus template: sesi tetap ada; audit tercatat.
  await page.getByRole("button", { name: "Jeda" }).click();
  await expect(page.getByText("Dijeda")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Hapus" }).click();
  await expect(page.getByText("Belum ada jadwal mingguan.")).toBeVisible();
  const { data: kept } = await admin().from("sessions").select("id").eq("id", first[0].id);
  expect(kept).toHaveLength(1);
  const { data: audit } = await admin().from("audit_log").select("action").eq("group_id", group.id).eq("entity", "session_template");
  expect(audit!.map((a) => a.action).sort()).toEqual(["create", "delete", "update"]);
});
