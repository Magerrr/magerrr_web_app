import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

/** Lebar & tinggi dari header IHDR PNG. */
function pngSize(buffer: Buffer) {
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function card(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  return pngSize(await response.body());
}

/** Host = p1, tamu p2–p4; sesi berjalan; opsional data vector §2 dan biaya 140.000. */
async function session(page: Page, withMatches: boolean) {
  await signInFast(page, uniqueEmail("recap"));
  const group = await createGroupViaApi(page, "Grup Recap");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids: Record<string, string> = { p1: hostRow!.id };
  for (const name of ["p2", "p3", "p4"]) {
    ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;
  }
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: {
      date: "2026-10-09",
      time: "19:00",
      durationMin: 120,
      venue: "GOR Recap",
      courtCount: 1,
      playMode: "kocok",
      rules: null,
      matchGames: null,
      note: null,
      attendeeIds: Object.values(ids),
      costs: { courtPerHour: withMatches ? 70000 : null, shuttle: null },
    },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  if (withMatches) {
    for (const [A, B, a, b] of [
      [["p1", "p2"], ["p3", "p4"], 21, 15],
      [["p1", "p3"], ["p2", "p4"], 21, 19],
      [["p1", "p4"], ["p2", "p3"], 18, 21],
    ] as const) {
      const saved = await page.request.post(`${api}/matches`, {
        data: { kind: "doubles", courtNo: null, A: A.map((p) => ids[p]), B: B.map((p) => ids[p]), games: [{ a, b }] },
      });
      expect(saved.status()).toBe(201);
    }
  }
  const { data } = await admin().from("sessions").select("share_token").eq("id", sessionId).single();
  return { groupId: group.id, sessionId, api, ids, token: data!.share_token as string, inviteCode: group.inviteCode };
}

test("recap vector §2: juara p2, sorotan, kartu PNG 1080×1920 & 1080×1080, OpenGraph, publik/privat", async ({ page, browser, baseURL }) => {
  const s = await session(page, true);
  const recapPath = `/s/${s.token}/recap`;

  // Sebelum ditutup: belum ada recap, kartu 404.
  await page.goto(recapPath);
  await expect(page.getByText("Recap muncul setelah sesi ditutup.")).toBeVisible();
  expect((await page.request.get(`${recapPath}/kartu/1x1`)).status()).toBe(404);

  // Tutup sesi dari halaman sesi → diarahkan ke recap.
  await page.goto(`/g/${s.groupId}/sesi/${s.sessionId}`);
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Tutup sesi" }).click();
  await expect(page).toHaveURL(new RegExp(`${recapPath}$`));
  await expect(page.getByTestId("highlight-champion")).toContainText("Juara sesi");
  await expect(page.getByTestId("highlight-champion")).toContainText("p2");
  await expect(page.getByTestId("highlight-champion")).toContainText("2 menang dari 3 main · 6 poin");
  await expect(page.getByTestId("highlight-tightestGame")).toContainText("21–19");
  await expect(page.getByTestId("highlight-biggestWin")).toContainText("21–15");
  await expect(page.getByTestId("highlight-bestPair")).toHaveCount(0);
  await expect(page.getByTestId("recap-matches").locator("li")).toHaveCount(3);
  // Sewa 70.000 × 1 lapangan × 2 jam = 140.000 → Rp35.000/orang.
  await expect(page.getByTestId("recap-money")).toContainText("Rp140.000");
  await expect(page.getByTestId("recap-money")).toContainText("Rp35.000/orang");
  await expect(page.getByTestId("recap-money")).toContainText("0/3 transfer");

  // Kartu PNG dengan ukuran tepat; unduhan sebagai lampiran.
  expect(await card(page.request, `${recapPath}/kartu/9x16`)).toEqual({ width: 1080, height: 1920 });
  expect(await card(page.request, `${recapPath}/kartu/1x1`)).toEqual({ width: 1080, height: 1080 });
  expect((await page.request.get(`${recapPath}/kartu/9x16?unduh`)).headers()["content-disposition"]).toMatch(/^attachment; filename="recap-2026-10-09-9x16\.png"$/);
  expect((await page.request.get(`${recapPath}/kartu/4x5`)).status()).toBe(404);
  const preview = page.getByRole("img", { name: "Kartu recap Grup Recap" });
  await preview.scrollIntoViewIfNeeded();
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080);

  // Pengunjung tanpa login: recap publik + metadata OpenGraph untuk pratinjau WhatsApp.
  const visitor = await browser.newContext({ baseURL });
  const pub = await visitor.newPage();
  await pub.goto(recapPath);
  await expect(pub.getByTestId("highlight-champion")).toContainText("p2");
  await expect(pub.getByRole("link", { name: "Kembali ke sesi" })).toHaveCount(0);
  await expect(pub.getByRole("button", { name: /Jadikan/ })).toHaveCount(0);
  await expect(pub.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`${recapPath}/kartu/1x1$`));
  await expect(pub.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1080");
  await expect(pub.locator('meta[property="og:title"]')).toHaveAttribute("content", /^Recap Grup Recap · /);
  await expect(pub.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await card(visitor.request, `${recapPath}/kartu/1x1`)).toEqual({ width: 1080, height: 1080 });

  // Admin mematikan recap publik → pengunjung 404 (halaman & kartu), anggota tetap bisa.
  await page.getByRole("button", { name: "Jadikan privat" }).click();
  await expect(page.getByTestId("recap-visibility")).toContainText("Recap privat");
  expect((await visitor.request.get(recapPath)).status()).toBe(404);
  expect((await visitor.request.get(`${recapPath}/kartu/1x1`)).status()).toBe(404);
  const member = await browser.newContext({ baseURL });
  expect((await member.request.post(`/api/join/${s.inviteCode}`, { data: { displayName: "Anggota" } })).status()).toBe(201);
  const memberPage = await member.newPage();
  await memberPage.goto(recapPath);
  await expect(memberPage.getByTestId("highlight-champion")).toContainText("p2");
  await expect(memberPage.locator('meta[property="og:image"]')).toHaveCount(0);
  // Bukan admin tidak bisa mengubah visibilitas.
  expect((await member.request.patch(`${s.api}/recap`, { data: { public: true } })).status()).toBe(403);
  await page.getByRole("button", { name: "Jadikan publik" }).click();
  await expect(page.getByTestId("recap-visibility")).toContainText("Recap publik");
  expect((await visitor.request.get(recapPath)).status()).toBe(200);
  await visitor.close();
  await member.close();
});

test("recap sesi tanpa match & tanpa biaya: tidak error, kartu kosong disembunyikan, PNG tetap jadi", async ({ page }) => {
  const s = await session(page, false);
  expect((await page.request.post(`${s.api}/status`, { data: { status: "finished" } })).status()).toBe(200);
  const recapPath = `/s/${s.token}/recap`;
  await page.goto(recapPath);
  await expect(page.getByText("Belum ada match yang tercatat di sesi ini.")).toBeVisible();
  await expect(page.getByTestId("highlights")).toHaveCount(0);
  await expect(page.getByTestId("recap-matches")).toHaveCount(0);
  await expect(page.getByTestId("recap-money")).toHaveCount(0);
  expect(await card(page.request, `${recapPath}/kartu/9x16`)).toEqual({ width: 1080, height: 1920 });
  expect(await card(page.request, `${recapPath}/kartu/1x1`)).toEqual({ width: 1080, height: 1080 });
  expect((await page.request.get(`/s/${"f".repeat(32)}/recap`)).status()).toBe(404);
});
