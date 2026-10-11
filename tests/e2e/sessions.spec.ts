import { expect, test, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

async function addGuests(page: Page, groupId: string, names: string[]): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const displayName of names) {
    const response = await page.request.post(`/api/groups/${groupId}/members`, { data: { displayName } });
    expect(response.status()).toBe(201);
    ids[displayName] = (await response.json()).id;
  }
  return ids;
}

async function selfMemberId(groupId: string): Promise<string> {
  const { data } = await admin().from("members").select("id").eq("group_id", groupId).eq("role", "admin").single();
  return data!.id;
}

const sessionInput = (over: Record<string, unknown> = {}) => ({
  date: "2026-10-01",
  time: "19:00",
  durationMin: 120,
  venue: "GOR Bulungan",
  courtCount: 1,
  playMode: "kocok",
  rules: null,
  matchGames: null,
  note: null,
  attendeeIds: [],
  costs: { courtPerHour: null, shuttle: null },
  ...over,
});

test("buat sesi: peserta, biaya, estimasi patungan = vector §5 #2", async ({ page }) => {
  await signInFast(page, uniqueEmail("host"));
  const group = await createGroupViaApi(page, "Grup Sesi");
  await addGuests(page, group.id, ["p2", "p3", "p4", "p5", "p6", "p7", "p8"]);
  const host = await selfMemberId(group.id);

  await page.goto(`/g/${group.id}`);
  await page.getByRole("link", { name: "Buat sesi" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Buat sesi" })).toBeVisible();
  // Belum ada sesi sebelumnya → hanya pembuat yang tercentang.
  await expect(page.getByText("1 hadir")).toBeVisible();
  await page.getByRole("button", { name: "Pilih semua" }).click();
  await expect(page.getByText("8 hadir")).toBeVisible();

  await page.getByLabel("Tempat").fill("GOR Bulungan");
  await page.getByLabel("Sewa per lapangan per jam (Rp)").fill("120000");
  await page.getByLabel("Biaya kok (Rp)").fill("25000");
  const estimate = page.getByTestId("cost-estimate");
  await expect(estimate.getByText("Rp240.000")).toBeVisible();
  // 265.000 ÷ 8 = 33.125 → dibulatkan ke Rp500 = 33.500 (vector §5 #2, lewat splitBill)
  await expect(estimate.getByTestId("per-person")).toHaveText("Rp33.500/org");

  await page.getByRole("button", { name: "Simpan sesi" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${group.id}/sesi/[0-9a-f-]{36}$`));
  await expect(page.getByText("Rencana", { exact: true })).toBeVisible();
  await expect(page.getByText("19.00–21.00 · GOR Bulungan")).toBeVisible();
  await expect(page.getByText("8 hadir")).toBeVisible();
  await expect(page.getByTestId("per-person")).toHaveText("Rp33.500/org");

  const sessionId = page.url().split("/").pop()!;
  const db = admin();
  const { data: session } = await db.from("sessions").select("starts_at, court_count, duration_min, rules, created_by").eq("id", sessionId).single();
  expect(session).toMatchObject({ court_count: 1, duration_min: 120, rules: null, created_by: host });
  const { data: expenses } = await db.from("expenses").select("name, amount, paid_by, preset, mode").eq("session_id", sessionId).order("amount");
  expect(expenses).toEqual([
    { name: "Kok", amount: 25_000, paid_by: host, preset: "shuttle", mode: "equal" },
    { name: "Sewa lapangan", amount: 240_000, paid_by: host, preset: "court", mode: "equal" },
  ]);
  const { data: log } = await db.from("audit_log").select("entity, action, actor_member_id").eq("group_id", group.id).eq("entity", "expense");
  expect(log).toHaveLength(2);
  expect(log!.every((l) => l.action === "create" && l.actor_member_id === host)).toBe(true);
});

test("peserta bisa diubah, sesi dimulai & ditutup, riwayat urut terbaru", async ({ page, browser, baseURL }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await signInFast(page, uniqueEmail("host"));
  const group = await createGroupViaApi(page, "Grup Riwayat");
  const host = await selfMemberId(group.id);
  const guests = await addGuests(page, group.id, ["Andi", "Bima", "Citra"]);

  const create = async (input: Record<string, unknown>) => {
    const response = await page.request.post(`/api/groups/${group.id}/sessions`, { data: sessionInput(input) });
    expect(response.status()).toBe(201);
    return (await response.json()).id as string;
  };
  await create({ date: "2026-10-01", attendeeIds: [host, guests.Andi, guests.Bima] });
  const latest = await create({ date: "2026-10-08", venue: "GOR Mahakam", attendeeIds: [host] });

  // Riwayat: terbaru dulu; pencarian sederhana per tempat.
  await page.goto(`/g/${group.id}`);
  const items = page.getByTestId("session-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Kam, 8 Okt");
  await expect(items.nth(0)).toContainText("GOR Mahakam");
  await expect(items.nth(1)).toContainText("Kam, 1 Okt");
  await expect(items.nth(1)).toContainText("3 hadir");
  await page.getByRole("searchbox").fill("bulungan");
  await page.getByRole("button", { name: "Cari" }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("GOR Bulungan");

  // Default peserta sesi baru = hadir di sesi terakhir yang punya peserta (8 Okt: hanya host).
  await page.goto(`/g/${group.id}/sesi/baru`);
  await expect(page.getByText("1 hadir")).toBeVisible();

  // Mulai butuh minimal 2 peserta.
  await page.goto(`/g/${group.id}/sesi/${latest}`);
  await page.getByRole("button", { name: "Mulai sesi" }).click();
  await expect(page.getByText("Tandai minimal 2 peserta hadir sebelum mulai.")).toBeVisible();

  await page.getByLabel("Andi").check();
  await page.getByLabel("Citra").check();
  await page.getByRole("button", { name: "Simpan peserta" }).click();
  await expect(page.getByText("Peserta disimpan.")).toBeVisible();
  const { data: present } = await admin().from("attendees").select("member_id").eq("session_id", latest).eq("present", true);
  expect(present!.map((a) => a.member_id).sort()).toEqual([host, guests.Andi, guests.Citra].sort());

  // Hapus centang tersimpan sebagai tidak hadir.
  await page.getByLabel("Citra").uncheck();
  await page.getByRole("button", { name: "Simpan peserta" }).click();
  await expect(page.getByText("Peserta disimpan.")).toBeVisible();
  await expect(page.getByText("2 hadir")).toBeVisible();

  await page.getByRole("button", { name: "Mulai sesi" }).click();
  await expect(page.getByText("Berlangsung", { exact: true })).toBeVisible();

  // Ubah detail saat berlangsung.
  await page.getByRole("link", { name: "Ubah detail" }).click();
  await page.getByLabel("Tempat").fill("GOR Senayan");
  await page.getByRole("button", { name: "Tambah lapangan" }).click();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("19.00–21.00 · GOR Senayan")).toBeVisible();

  // Tutup sesi → langsung ke recap (R1); sesi tanpa match tidak error.
  await page.getByRole("button", { name: "Tutup sesi" }).click();
  await expect(page.getByRole("heading", { name: "Recap mabar" })).toBeVisible();
  await expect(page.getByText("Belum ada match yang tercatat di sesi ini.")).toBeVisible();
  await page.getByRole("link", { name: "Kembali ke sesi" }).click();
  await expect(page.getByText("Selesai", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ubah detail" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Simpan peserta" })).toHaveCount(0);

  const { data: done } = await admin().from("sessions").select("status, venue, court_count").eq("id", latest).single();
  expect(done).toEqual({ status: "finished", venue: "GOR Senayan", court_count: 2 });
  const late = await page.request.put(`/api/groups/${group.id}/sessions/${latest}/attendees`, { data: { memberIds: [host] } });
  expect(late.status()).toBe(422);

  // Bukan admin tidak bisa membuat sesi atau mengubah status.
  const guestCtx = await browser.newContext({ baseURL });
  expect((await guestCtx.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Tamu Baru" } })).status()).toBe(201);
  expect((await guestCtx.request.post(`/api/groups/${group.id}/sessions`, { data: sessionInput() })).status()).toBe(403);
  expect(
    (await guestCtx.request.post(`/api/groups/${group.id}/sessions/${latest}/status`, { data: { status: "running" } })).status(),
  ).toBe(403);
  await guestCtx.close();
});

test("validasi sesi di server", async ({ page }) => {
  await signInFast(page, uniqueEmail("host"));
  const group = await createGroupViaApi(page, "Grup Validasi");
  const other = await createGroupViaApi(page, "Grup Lain");
  const outsider = await selfMemberId(other.id);
  const post = (input: Record<string, unknown>) => page.request.post(`/api/groups/${group.id}/sessions`, { data: sessionInput(input) });

  expect((await post({ date: "2026-02-30" })).status()).toBe(400);
  expect((await post({ courtCount: 13 })).status()).toBe(400);
  expect((await post({ costs: { courtPerHour: 1.5, shuttle: null } })).status()).toBe(400);
  // Peserta dari grup lain ditolak.
  expect((await post({ attendeeIds: [outsider] })).status()).toBe(422);
  // Aturan sama dengan aturan grup tidak disimpan sebagai override.
  const same = await post({ rules: { target: 21, deuce: true, cap: 30 }, matchGames: 1 });
  expect(same.status()).toBe(201);
  const { data } = await admin().from("sessions").select("rules, match_games").eq("id", (await same.json()).id).single();
  expect(data).toEqual({ rules: null, match_games: null });
});
