import { expect, test } from "@playwright/test";
import { admin, anon, createGroupViaApi, signInFast, signInViaEmail, uniqueEmail } from "./support";

test("host daftar via email, buat grup, tamu gabung lewat tautan undangan", async ({ page, browser }) => {
  // Host: daftar dengan magic link (Mailpit lokal) lalu buat grup lewat UI.
  await signInViaEmail(page, uniqueEmail("host"));
  await page.getByRole("link", { name: "Buat grup" }).click();
  await page.getByLabel("Nama grup").fill("Mabar Jumat Malam");
  await page.getByRole("button", { name: "Buat grup" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mabar Jumat Malam" })).toBeVisible();
  await expect(page.getByText("Admin")).toBeVisible();
  const groupUrl = page.url();

  await page.getByRole("link", { name: /Anggota/ }).click();
  const inviteUrl = await page.getByTestId("invite-url").inputValue();
  expect(inviteUrl).toMatch(/\/gabung\/[0-9a-f]{32}$/);

  // Tamu: konteks peramban lain, tanpa akun.
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteUrl);
  await expect(guest.getByRole("heading", { level: 1, name: "Mabar Jumat Malam" })).toBeVisible();
  await guest.getByLabel("Nama panggilan").fill("Budi");
  await guest.getByRole("button", { name: "Gabung grup" }).click();
  await expect(guest).toHaveURL(groupUrl);
  await expect(guest.getByText("sebagai Budi")).toBeVisible();
  await expect(guest.getByText("Tamu", { exact: true })).toBeVisible();

  // Tamu dikenali lagi lewat cookie: tautan undangan langsung membuka grup.
  await guest.goto(inviteUrl);
  await expect(guest).toHaveURL(groupUrl);
  const cookie = (await guestContext.cookies()).find((c) => c.name.startsWith("mg_tamu_"));
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(360 * 24 * 3600 * 1000);

  // Host melihat tamu di daftar anggota.
  await page.reload();
  const budi = page.getByTestId("member-row").filter({ hasText: "Budi" });
  await expect(budi).toBeVisible();
  await expect(budi.getByText("Tamu")).toBeVisible();

  // Nama yang sama tidak bisa dipakai dua kali.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(inviteUrl);
  await otherPage.getByLabel("Nama panggilan").fill("Budi");
  await otherPage.getByRole("button", { name: "Gabung grup" }).click();
  await expect(otherPage.getByText("Nama ini sudah dipakai di grup")).toBeVisible();

  await guestContext.close();
  await other.close();
});

test("hanya admin yang boleh mengubah aturan grup", async ({ page: host, browser, baseURL }) => {
  await signInFast(host, uniqueEmail("admin"));
  const group = await createGroupViaApi(host, "Grup Aturan");
  const rulesUrl = `/api/groups/${group.id}`;
  const poin15 = { rules: { target: 15, deuce: true, cap: 21 } };

  const memberCtx = await browser.newContext({ baseURL });
  const member = await memberCtx.newPage();
  await signInFast(member, uniqueEmail("anggota"));
  expect((await member.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Anggota Akun" } })).status()).toBe(201);

  const guestCtx = await browser.newContext({ baseURL });
  expect((await guestCtx.request.post(`/api/join/${group.inviteCode}`, { data: { displayName: "Tamu Satu" } })).status()).toBe(201);

  const outsiderCtx = await browser.newContext({ baseURL });
  const outsider = await outsiderCtx.newPage();
  await signInFast(outsider, uniqueEmail("luar"));

  const anonymousCtx = await browser.newContext({ baseURL });

  // Bukan admin → 403; tak dikenal → 401.
  expect((await anonymousCtx.request.patch(rulesUrl, { data: poin15 })).status()).toBe(401);
  expect((await guestCtx.request.patch(rulesUrl, { data: poin15 })).status()).toBe(403);
  expect((await member.request.patch(rulesUrl, { data: poin15 })).status()).toBe(403);
  expect((await outsider.request.patch(rulesUrl, { data: poin15 })).status()).toBe(403);
  expect((await guestCtx.request.post(`/api/groups/${group.id}/invite`)).status()).toBe(403);
  expect((await member.request.post(`/api/groups/${group.id}/members`, { data: { displayName: "X" } })).status()).toBe(403);

  // Lintas origin ditolak walau admin.
  const crossSite = await host.request.patch(rulesUrl, { data: poin15, headers: { origin: "https://evil.example" } });
  expect(crossSite.status()).toBe(403);

  // Admin → 200, aturan berubah, audit_log mencatat pelaku.
  const ok = await host.request.patch(rulesUrl, { data: poin15 });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).rules).toEqual(poin15.rules);
  const db = admin();
  const { data: hostMember } = await db.from("members").select("id").eq("group_id", group.id).eq("role", "admin").single();
  const { data: log } = await db.from("audit_log").select("entity, action, actor_member_id, after").eq("group_id", group.id);
  expect(log).toHaveLength(1);
  expect(log![0]).toMatchObject({ entity: "rules", action: "update", actor_member_id: hostMember!.id });

  // Validasi: cap < target ditolak.
  const invalid = await host.request.patch(rulesUrl, { data: { rules: { target: 21, deuce: true, cap: 20 } } });
  expect(invalid.status()).toBe(400);

  // Tamu tidak bisa dijadikan admin; anggota berakun bisa, lalu boleh mengubah aturan.
  const { data: rows } = await db.from("members").select("id, display_name").eq("group_id", group.id);
  const idOf = (name: string) => rows!.find((r) => r.display_name === name)!.id;
  const promoteGuest = await host.request.patch(`/api/groups/${group.id}/members/${idOf("Tamu Satu")}`, { data: { role: "admin" } });
  expect(promoteGuest.status()).toBe(422);
  const promote = await host.request.patch(`/api/groups/${group.id}/members/${idOf("Anggota Akun")}`, { data: { role: "admin" } });
  expect(promote.status()).toBe(200);
  expect((await member.request.patch(rulesUrl, { data: { matchGames: 3 } })).status()).toBe(200);

  for (const ctx of [memberCtx, guestCtx, outsiderCtx, anonymousCtx]) await ctx.close();
});

test("tabel tidak bisa diakses langsung dengan publishable key (RLS)", async () => {
  const client = anon();
  const groups = await client.from("groups").select("id, invite_code");
  expect(groups.data).toEqual([]);
  const members = await client.from("members").select("claim_token");
  expect(members.data).toEqual([]);
  const insert = await client.from("audit_log").insert({ group_id: crypto.randomUUID(), entity: "x", entity_id: "x", action: "x" });
  expect(insert.error).not.toBeNull();
  const rpc = await client.rpc("create_group", { p_owner: crypto.randomUUID(), p_name: "x", p_emoji: "", p_display_name: "x" });
  expect(rpc.error?.code).toBe("42501");
});

test("admin mengubah pengaturan, menambah tamu, dan mengatur grade lewat UI", async ({ page }) => {
  await signInFast(page, uniqueEmail("pengurus"));
  const group = await createGroupViaApi(page, "Grup Pengaturan");

  await page.goto(`/g/${group.id}/pengaturan`);
  await page.getByText("15 poin", { exact: true }).click();
  await expect(page.getByText("Game selesai di 15 poin. Jika 14–14, harus unggul 2 poin; maksimal 21.")).toBeVisible();
  await page.getByText("Best of 3").click();
  await page.getByLabel("Menang").fill("2");
  await page.getByText("Bonus untuk kalah tipis").click();
  await page.getByLabel("Selisih maksimal").fill("3");
  await page.getByText("Rp1.000").click();
  await page.getByText("Rotasi (kalah keluar)").click();
  await page.getByRole("button", { name: "Simpan pengaturan" }).click();
  await expect(page.getByText("Pengaturan disimpan.")).toBeVisible();

  const { data: saved } = await admin()
    .from("groups")
    .select("rules, match_games, scoring, round_to, default_play_mode")
    .eq("id", group.id)
    .single();
  expect(saved).toEqual({
    rules: { target: 15, deuce: true, cap: 21 },
    match_games: 3,
    scoring: { winPoints: 2, lossPoints: 0, lossBonus: { maxMargin: 3, points: 1 }, minMatches: 0 },
    round_to: 1000,
    default_play_mode: "rotasi",
  });

  // Pengaturan tersimpan tampil lagi setelah dimuat ulang.
  await page.reload();
  await expect(page.getByRole("radio", { name: "15 poin" })).toBeChecked();
  await expect(page.getByLabel("Menang")).toHaveValue("2");

  // Input tidak valid → pesan dari server, data tidak berubah.
  await page.getByText("Kustom").click();
  await page.getByLabel("Target poin").fill("3");
  await page.getByRole("button", { name: "Simpan pengaturan" }).click();
  await expect(page.getByText("Target minimal 5.")).toBeVisible();

  // Tambah tamu lalu beri grade.
  await page.goto(`/g/${group.id}/anggota`);
  await page.getByLabel("Tambah pemain tamu").fill("Sari");
  await page.getByRole("button", { name: "Tambah" }).click();
  const sari = page.getByTestId("member-row").filter({ hasText: "Sari" });
  await expect(sari.getByText("Tamu")).toBeVisible();
  await sari.getByLabel("Grade").selectOption("B");
  await expect.poll(async () => {
    const { data } = await admin().from("members").select("grade").eq("group_id", group.id).eq("display_name", "Sari").single();
    return data?.grade;
  }).toBe("B");
  await expect(sari.getByRole("button", { name: "Jadikan admin" })).toHaveCount(0);
});
