import { expect, test, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

type Setup = { groupId: string; sessionId: string; ids: Record<string, string>; host: string; hostName: string; inviteCode: string; api: string };

async function billSession(page: Page, guests: string[], session: Record<string, unknown>, groupPatch?: Record<string, unknown>): Promise<Setup> {
  await signInFast(page, uniqueEmail("host"));
  const group = await createGroupViaApi(page, "Grup Patungan");
  if (groupPatch) expect((await page.request.patch(`/api/groups/${group.id}`, { data: groupPatch })).status()).toBe(200);
  const { data: hostRow } = await admin().from("members").select("id, display_name").eq("group_id", group.id).eq("role", "admin").single();
  const ids: Record<string, string> = {};
  for (const name of guests) {
    ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;
  }
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: {
      date: "2026-10-09",
      time: "19:00",
      durationMin: 120,
      venue: "GOR Patungan",
      courtCount: 2,
      playMode: "kocok",
      rules: null,
      matchGames: null,
      note: null,
      attendeeIds: [hostRow!.id, ...Object.values(ids)],
      costs: { courtPerHour: null, shuttle: null },
      ...session,
    },
  });
  expect(created.status()).toBe(201);
  const sessionId = (await created.json()).id as string;
  return {
    groupId: group.id,
    sessionId,
    ids,
    host: hostRow!.id,
    hostName: hostRow!.display_name,
    inviteCode: group.inviteCode,
    api: `/api/groups/${group.id}/sessions/${sessionId}`,
  };
}

const transfers = (page: Page) =>
  page
    .getByTestId("transfer-row")
    .evaluateAll((rows) =>
      rows.map((r) => [r.getAttribute("data-from"), r.getAttribute("data-to"), r.querySelector("[data-testid=transfer-amount]")?.textContent]),
    );

const row = (page: Page, from: string) => page.locator(`[data-testid=transfer-row][data-from="${from}"]`);

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("vector §5 #1–#2: biaya awal, tandai lunas, status dipertahankan/direset, audit, tagihan publik & QRIS", async ({ page, browser, baseURL }) => {
  page.on("dialog", (d) => d.accept());
  const others = ["p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  // Sewa 60.000/jam × 2 lapangan × 2 jam = 240.000; kok 40.000; ditalangi host (Raka); pembulatan 500.
  const s = await billSession(page, others, { costs: { courtPerHour: 60000, shuttle: 40000 } });

  // #1: tiap orang 35.000 → 7 transfer × 35.000 ke host.
  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}`);
  await page.getByRole("link", { name: "Patungan" }).click();
  await expect(page.getByRole("heading", { name: "Patungan", level: 1 })).toBeVisible();
  expect(new Set(await transfers(page))).toEqual(new Set(others.map((p) => [s.ids[p], s.host, "Rp35.000"])));
  await expect(page.getByTestId("transfer-row")).toHaveCount(7);
  await expect(page.getByTestId("bill-progress")).toContainText("0/7");
  await expect(page.getByTestId("person-share")).toHaveText(Array(8).fill("Rp35.000"));
  await expect(page.locator(`[data-testid=person-row][data-member="${s.host}"]`).getByTestId("person-transfer")).toHaveText("terima Rp245.000");
  await expect(page.getByTestId("expense-total")).toHaveText("Total biaya Rp280.000");

  // Info pembayaran host (bank + QRIS).
  await page.getByRole("link", { name: "Atur info pembayaranmu" }).click();
  await page.getByLabel("Nama bank").fill("BCA");
  await page.getByLabel("Nomor rekening").fill("1234567890");
  await page.getByLabel("Atas nama (opsional)").fill("Raka Putra");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByTestId("account-no")).toHaveText("1234567890");
  await page.getByText("QRIS", { exact: true }).click();
  await page.getByLabel("Gambar QRIS").setInputFiles({ name: "qris.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("img", { name: "Kode QRIS QRIS" })).toBeVisible();
  // Bukan gambar → ditolak meski mengaku PNG.
  const fake = await page.request.post(`/api/groups/${s.groupId}/payment-infos/qris`, {
    multipart: { label: "x", file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") } },
  });
  expect(fake.status()).toBe(422);
  await page.getByRole("link", { name: "Kembali" }).click();
  await expect(page).toHaveURL(/\/patungan$/);

  // Host menandai p2 lunas.
  await row(page, s.ids.p2).getByRole("button", { name: "Tandai lunas" }).click();
  await expect(row(page, s.ids.p2)).toContainText("Lunas");
  await expect(page.getByTestId("bill-progress")).toContainText("1/7");
  await expect(page.getByTestId("collected")).toHaveText("Rp35.000");

  // Biaya yang tidak mengubah transfer (minum host, nominal per orang ke host sendiri) → status lunas dipertahankan.
  const drink = await page.request.post(`${s.api}/expenses`, {
    data: { name: "Minum host", amount: 10000, paidBy: s.host, preset: "drink", split: { mode: "custom", shares: { [s.host]: 10000 } } },
  });
  expect(drink.status()).toBe(201);
  expect((await drink.json()).reset).toEqual([]);
  expect((await page.request.delete(`${s.api}/expenses/${(await drink.json()).id}`)).status()).toBe(200);
  await page.reload();
  await expect(row(page, s.ids.p2)).toContainText("Lunas");

  // #2: kok diubah 40.000 → 25.000 lewat UI → total 265.000, share 33.125 → transfer 33.500; status p2 direset dengan peringatan.
  const kok = page.getByTestId("expense-row").filter({ hasText: "Kok" });
  await kok.getByRole("button", { name: "Ubah" }).click();
  await page.getByLabel("Nominal (Rp)").fill("25000");
  await page.getByRole("button", { name: "Simpan biaya" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Status bayar direset" })).toContainText(
    "Biaya \"Kok\" diubah. Status bayar direset karena nominal transfer berubah: p2 ke",
  );
  await expect(page.getByTestId("transfer-amount")).toHaveText(Array(7).fill("Rp33.500"));
  await expect(row(page, s.ids.p2)).toContainText("Belum bayar");
  await expect(page.getByTestId("person-share")).toHaveText(Array(8).fill("Rp33.125"));
  await expect(page.locator(`[data-testid=person-row][data-member="${s.host}"]`).getByTestId("person-transfer")).toHaveText("terima Rp234.500");
  await expect(page.getByTestId("expense-total")).toHaveText("Total biaya Rp265.000");

  const { data: audit } = await admin()
    .from("audit_log")
    .select("entity, action, before, after")
    .eq("group_id", s.groupId)
    .in("entity", ["expense", "payment"])
    .order("id");
  const kokUpdate = audit!.find((a) => a.entity === "expense" && a.action === "update");
  expect(kokUpdate).toMatchObject({ before: { amount: 40000, name: "Kok" }, after: { amount: 25000, name: "Kok" } });
  expect(Object.values((kokUpdate!.after as { shares: Record<string, number> }).shares)).toEqual(Array(8).fill(3125));
  expect(audit!.filter((a) => a.entity === "expense").map((a) => a.action)).toEqual(["create", "create", "create", "delete", "update"]);
  const p2Payments = audit!.filter((a) => a.entity === "payment" && (a.before as { from_member: string }).from_member === s.ids.p2);
  expect(p2Payments.map((a) => [(a.before as { status: string }).status, (a.after as { status: string }).status])).toEqual([
    ["unpaid", "paid"],
    ["paid", "unpaid"],
  ]);

  // Bagikan: teks WhatsApp + tautan publik.
  const shareText = await page.getByTestId("bill-text").textContent();
  expect(shareText).toContain(`Transfer ke ${s.hostName}:`);
  expect(shareText).toContain("- p3 Rp33.500");
  expect(shareText).toContain("- BCA 1234567890 a.n. Raka Putra");
  const { data: token } = await admin().from("sessions").select("share_token").eq("id", s.sessionId).single();
  const publicPath = `/s/${token!.share_token}/tagihan`;
  expect(shareText).toContain(publicPath);
  await expect(page.getByRole("link", { name: "Bagikan ke WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=Tagihan%20mabar/);

  // Halaman publik tanpa login: bagian tiap orang, rekening, QRIS, "Saya sudah bayar".
  const visitor = await browser.newContext({ baseURL });
  const pub = await visitor.newPage();
  await pub.goto(publicPath);
  await expect(pub.getByRole("heading", { name: "Tagihan patungan" })).toBeVisible();
  await expect(pub.getByTestId("transfer-amount")).toHaveText(Array(7).fill("Rp33.500"));
  await expect(pub.getByTestId("account-no")).toHaveText("1234567890");
  const qr = pub.getByRole("img", { name: "Kode QRIS QRIS" });
  await expect(qr).toBeVisible();
  const qrResponse = await pub.request.get((await qr.getAttribute("src"))!);
  expect(qrResponse.status()).toBe(200);
  expect(qrResponse.headers()["content-type"]).toBe("image/png");
  await row(pub, s.ids.p3).getByRole("button", { name: "Saya sudah bayar" }).click();
  await expect(row(pub, s.ids.p3)).toContainText("Menunggu konfirmasi");
  await expect(pub.getByRole("button", { name: /Tandai lunas|Konfirmasi/ })).toHaveCount(0);
  // Token salah → 404; endpoint admin → 401.
  expect((await pub.request.get(`/s/${"0".repeat(32)}/tagihan`)).status()).toBe(404);
  const { data: p3Row } = await admin().from("settlements").select("id").eq("session_id", s.sessionId).eq("from_member", s.ids.p3).single();
  expect((await pub.request.patch(`${s.api}/settlements/${p3Row!.id}`, { data: { action: "paid" } })).status()).toBe(401);
  await visitor.close();

  // Host mengonfirmasi laporan p3.
  await page.reload();
  await row(page, s.ids.p3).getByRole("button", { name: "Konfirmasi lunas" }).click();
  await expect(row(page, s.ids.p3)).toContainText("Lunas");
  await expect(page.getByTestId("bill-progress")).toContainText("1/7");
});

test("vector §5 #3–#5 lewat form: sisa pembagian, beberapa penalang, custom tak seimbang; izin", async ({ page, browser, baseURL }) => {
  // Pembulatan Rp1 agar angka mentah terlihat (vector #3, #4).
  const s = await billSession(page, ["B", "C", "D"], {}, { roundTo: 1 });
  const A = s.host;
  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}/patungan`);
  await expect(page.getByText("Belum ada biaya.")).toBeVisible();

  let expenseCount = 0;
  const addExpense = async (preset: string, amount: string, payer: string) => {
    await page.getByRole("button", { name: "Tambah biaya" }).click();
    await page.getByTestId("expense-form").getByText(preset, { exact: true }).click();
    await page.getByLabel("Nominal (Rp)").fill(amount);
    await page.getByLabel("Ditalangi oleh").selectOption({ label: payer });
    await page.getByRole("button", { name: "Simpan biaya" }).click();
    await expect(page.getByTestId("expense-form")).toHaveCount(0);
    await expect(page.getByTestId("expense-row")).toHaveCount(++expenseCount);
  };

  // #4: A bayar lapangan 200.000, B bayar kok 60.000, rata ke 4 → C→A 65.000, D→A 65.000, B→A 5.000.
  await addExpense("Sewa lapangan", "200000", s.hostName);
  await addExpense("Kok", "60000", "B");
  await expect(page.getByTestId("transfer-row")).toHaveCount(3);
  expect(new Set(await transfers(page))).toEqual(
    new Set([
      [s.ids.C, A, "Rp65.000"],
      [s.ids.D, A, "Rp65.000"],
      [s.ids.B, A, "Rp5.000"],
    ]),
  );
  await expect(page.getByTestId("person-share")).toHaveText(Array(4).fill("Rp65.000"));

  // #3: 100.000 rata ke 3 peserta terpilih → 33.334 / 33.333 / 33.333 (pratinjau memakai fungsi inti).
  await page.getByRole("button", { name: "Tambah biaya" }).click();
  const form = page.getByTestId("expense-form");
  await form.getByText("Lainnya", { exact: true }).click();
  await page.getByLabel("Nama biaya").fill("Snack");
  await page.getByLabel("Nominal (Rp)").fill("100000");
  await form.getByText("Pilih peserta", { exact: true }).click();
  await form.getByRole("checkbox", { name: "D", exact: true }).uncheck();
  const preview = await page.getByTestId("share-preview").locator("li span:last-child").allTextContents();
  expect(preview.sort()).toEqual(["Rp33.333", "Rp33.333", "Rp33.334"]);

  // #5: nominal per orang tak seimbang → ditolak dengan pesan jelas (klien & server).
  await form.getByText("Nominal per orang", { exact: true }).click();
  await page.getByLabel("Nominal B", { exact: true }).fill("30000");
  await page.getByLabel("Nominal C", { exact: true }).fill("5000");
  await expect(form).toContainText("Terisi Rp35.000 dari Rp100.000 · kurang Rp65.000");
  await page.getByRole("button", { name: "Simpan biaya" }).click();
  await expect(form.getByRole("alert")).toHaveText("Jumlah bagian (Rp35.000) harus sama dengan nominal biaya (Rp100.000).");
  const unbalanced = await page.request.post(`${s.api}/expenses`, {
    data: { name: "Snack", amount: 100000, paidBy: A, preset: null, split: { mode: "custom", shares: { [s.ids.B]: 30000, [s.ids.C]: 5000 } } },
  });
  expect(unbalanced.status()).toBe(400);
  expect((await unbalanced.json()).error).toBe("Jumlah bagian (Rp35.000) harus sama dengan nominal biaya (Rp100.000).");
  await page.getByRole("button", { name: "Batal" }).click();

  // Peserta berubah (D tidak hadir) → biaya "rata semua hadir" dibagi ulang ke 3 orang.
  expect((await page.request.put(`${s.api}/attendees`, { data: { memberIds: [A, s.ids.B, s.ids.C] } })).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("person-share")).toHaveCount(3);
  expect((await transfers(page)).some(([from]) => from === s.ids.D)).toBe(false);

  // Bukan admin → 403 untuk tulis biaya & status bayar.
  const guestCtx = await browser.newContext({ baseURL });
  expect((await guestCtx.request.post(`/api/join/${s.inviteCode}`, { data: { displayName: "Penonton" } })).status()).toBe(201);
  expect((await guestCtx.request.post(`${s.api}/expenses`, { data: { name: "x", amount: 1, paidBy: A, preset: null, split: { mode: "all" } } })).status()).toBe(403);
  const { data: any } = await admin().from("settlements").select("id").eq("session_id", s.sessionId).limit(1).single();
  expect((await guestCtx.request.patch(`${s.api}/settlements/${any!.id}`, { data: { action: "paid" } })).status()).toBe(403);
  await guestCtx.close();
});
