import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

// Audit BUILD_PLAN Fase 8: aksesibilitas (axe, WCAG 2.1 AA termasuk kontras), target sentuh >= 44px,
// layar 320–1280px (ponsel sampai desktop) tanpa scroll samping, PWA bisa dipasang & offline.

const AXE = join(process.cwd(), "node_modules/axe-core/axe.min.js");

interface Violation {
  id: string;
  help: string;
  nodes: { target: string[] }[];
}

async function axe(page: Page): Promise<string[]> {
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: AXE });
  const violations: Violation[] = await page.evaluate(async () => {
    // @ts-expect-error axe disuntikkan lewat addScriptTag
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return result.violations;
  });
  return violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** Kontrol yang terlihat & lebih kecil dari 44×44 (tautan di dalam kalimat dikecualikan, WCAG 2.5.8). */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = "button, a[href], select, summary, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role=button]";
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.position === "absolute") return false;
        if (el.tagName === "A" && style.display === "inline") return false;
        return r.height < 43.5 || r.width < 43.5;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
  });
}

/** Ponsel kecil–besar (target utama PRD §9), tablet, laptop, desktop. */
const WIDTHS = [320, 360, 430, 768, 1024, 1280];

/** Halaman dimuat sekali; lebar diganti tanpa muat ulang (tata letak murni CSS). */
async function audit(page: Page, path: string, problems: string[]) {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${path} @${width}px: scroll samping ${overflow}px`);
    if (width === 360 || width === 1280) {
      for (const v of await axe(page)) problems.push(`${path} @${width}px: ${v}`);
    }
    if (width === 360 || width === 768) {
      for (const t of await smallTargets(page)) problems.push(`${path} @${width}px: target kecil ${t}`);
    }
  }
}

/** Grup + 3 tamu; sesi A selesai (vector §2 + biaya), sesi B berlangsung dengan satu match di lapangan. */
async function fixture(page: Page) {
  await signInFast(page, uniqueEmail("audit"));
  const group = await createGroupViaApi(page, "Grup Audit");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids: Record<string, string> = { p1: hostRow!.id };
  for (const name of ["p2", "p3", "p4"]) {
    ids[name] = (await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id;
  }
  const newSession = async (costs: Record<string, number | null>) => {
    const res = await page.request.post(`/api/groups/${group.id}/sessions`, {
      data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Audit", courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: Object.values(ids), costs: { courtPerHour: null, shuttle: null, ...costs } },
    });
    const id = (await res.json()).id as string;
    expect((await page.request.post(`/api/groups/${group.id}/sessions/${id}/status`, { data: { status: "running" } })).status()).toBe(200);
    return id;
  };
  const done = await newSession({ courtPerHour: 70000 });
  const api = `/api/groups/${group.id}/sessions/${done}`;
  for (const [A, B, a, b] of [
    [["p1", "p2"], ["p3", "p4"], 21, 15],
    [["p1", "p3"], ["p2", "p4"], 21, 19],
    [["p1", "p4"], ["p2", "p3"], 18, 21],
  ] as const) {
    await page.request.post(`${api}/matches`, { data: { kind: "doubles", courtNo: null, A: A.map((p) => ids[p]), B: B.map((p) => ids[p]), games: [{ a, b }] } });
  }
  await page.request.post(`/api/groups/${group.id}/payment-infos`, { data: { kind: "bank", label: "BCA", accountNo: "1234567890", accountName: "Host" } });
  expect((await page.request.post(`${api}/status`, { data: { status: "finished" } })).status()).toBe(200);
  const live = await newSession({});
  const started = await page.request.post(`/api/groups/${group.id}/sessions/${live}/matches/start`, {
    data: { matches: [{ courtNo: 1, kind: "doubles", A: [ids.p1, ids.p2], B: [ids.p3, ids.p4] }], seed: 1, queue: null },
  });
  expect(started.status()).toBe(201);
  // Turnamen tunggal di sesi berlangsung; sesi terencana untuk form turnamen; satu pesan obrolan.
  expect((await page.request.post(`/api/groups/${group.id}/sessions/${live}/tournament`, { data: { name: "Cup Audit", seeding: "rating", entries: { mode: "singles", memberIds: Object.values(ids) } } })).status()).toBe(201);
  const plannedRes = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-16", time: "19:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: Object.values(ids), costs: { courtPerHour: null, shuttle: null } },
  });
  const planned = (await plannedRes.json()).id as string;
  // Grup + gugur (4 tunggal, 2 grup, juara grup lolos) dengan satu partai grup selesai.
  const cup = await newSession({});
  const cupApi = `/api/groups/${group.id}/sessions/${cup}`;
  const cupBody = { name: "Piala Audit", seeding: "rating", format: "groups_knockout", groups: { count: 2, advance: 1 }, entries: { mode: "singles", memberIds: Object.values(ids) } };
  expect((await page.request.post(`${cupApi}/tournament`, { data: cupBody })).status()).toBe(201);
  const cupMatch = await page.request.post(`${cupApi}/tournament/matches`, { data: { a: 1, b: 4, courtNo: 1 } });
  expect(cupMatch.status()).toBe(201);
  expect((await page.request.post(`${cupApi}/matches/${(await cupMatch.json()).id}/complete`, { data: { games: [{ a: 21, b: 17 }] } })).status()).toBe(200);
  expect((await page.request.post(`/api/groups/${group.id}/chat`, { data: { body: "Halo semua, Sabtu main ya" } })).status()).toBe(201);
  const { data } = await admin().from("sessions").select("share_token").eq("id", done).single();
  const { data: liveRow } = await admin().from("sessions").select("share_token").eq("id", live).single();
  const { data: cupRow } = await admin().from("sessions").select("share_token").eq("id", cup).single();
  return {
    groupId: group.id,
    done,
    live,
    planned,
    cup,
    token: data!.share_token as string,
    liveToken: liveRow!.share_token as string,
    cupToken: cupRow!.share_token as string,
    inviteCode: group.inviteCode,
    hostId: ids.p1,
  };
}

test("aksesibilitas, target sentuh, dan lebar 320–1280px di semua halaman utama", async ({ page, browser, baseURL }) => {
  test.setTimeout(300_000);
  const f = await fixture(page);
  const g = `/g/${f.groupId}`;
  const problems: string[] = [];
  for (const path of [
    "/",
    g,
    `${g}/anggota`,
    `${g}/pengaturan`,
    `${g}/leaderboard?periode=semua`,
    `${g}/leaderboard?tab=pasangan&periode=semua`,
    `${g}/sesi/baru`,
    `${g}/sesi/${f.done}`,
    `${g}/sesi/${f.live}`,
    `${g}/sesi/${f.done}/main`,
    `${g}/sesi/${f.live}/main`,
    `${g}/sesi/${f.live}/catat`,
    `${g}/sesi/${f.done}/patungan`,
    `${g}/pembayaran`,
    `${g}/saldo`,
    `/s/${f.token}/tagihan`,
    `/s/${f.token}/recap`,
    `${g}/leaderboard?tab=form&periode=semua`,
    `${g}/anggota/${f.hostId}`,
    `${g}/musim`,
    `/s/${f.token}/skor`,
    `${g}/kiko`,
    `${g}/obrolan`,
    `${g}/sesi/${f.planned}/turnamen`,
    `${g}/sesi/${f.live}/turnamen`,
    `${g}/sesi/${f.live}/turnamen?tab=jadwal`,
    `${g}/sesi/${f.live}/turnamen?tab=klasemen`,
    `/s/${f.liveToken}/turnamen`,
    `${g}/sesi/${f.cup}/turnamen`,
    `${g}/sesi/${f.cup}/turnamen?tab=bagan`,
    `${g}/sesi/${f.cup}/turnamen?tab=jadwal`,
    `/s/${f.cupToken}/turnamen`,
  ]) {
    await audit(page, path, problems);
  }

  // Pengunjung tanpa akun.
  const visitor = await (await browser.newContext({ baseURL })).newPage();
  for (const path of ["/", "/masuk", `/gabung/${f.inviteCode}`, "/offline", `/s/${f.token}/tagihan`, `/s/${f.token}/recap`, `/s/${f.token}/skor`, `/s/${f.liveToken}/turnamen`, `/klaim/${"0".repeat(32)}`, `${g}`, `${g}/obrolan`]) {
    await audit(visitor, path, problems);
  }
  await visitor.context().close();
  expect(problems).toEqual([]);
});

test("fokus keyboard terlihat", async ({ page }) => {
  await page.goto("/masuk");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    return { tag: el.tagName, style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.tag).not.toBe("BODY");
  expect(outline.style).not.toBe("none");
  expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
});

test("PWA: manifest & service worker memenuhi syarat pasang; offline menampilkan salinan terakhir atau halaman offline", async ({ page, context }) => {
  await page.goto("/");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Magerrr", display: "standalone", start_url: "/", lang: "id" });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  // Service worker aktif dan mengendalikan halaman.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null)).toBe("activated");

  // Kriteria installability Chrome (sama dengan yang dipakai Lighthouse).
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
  // Sesi CDP tambahan mengganggu emulasi offline (navigator.onLine tetap true); lepas dulu.
  await cdp.detach();

  // Halaman yang sudah dibuka tetap tampil offline (dengan banner); yang belum → halaman offline.
  await page.goto("/masuk");
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.waitForLoadState("networkidle"); // aset halaman ini sudah masuk cache
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Kamu sedang offline" })).toBeVisible();
  await page.goto("/gabung/" + "0".repeat(32));
  await expect(page.getByRole("heading", { name: "Kamu sedang offline" })).toBeVisible();
  // Koneksi kembali → "Coba lagi" memuat halaman asli (jaringan service worker butuh sesaat untuk pulih).
  await context.setOffline(false);
  await expect(async () => {
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await expect(page.getByRole("heading", { name: "Tautan tidak berlaku" })).toBeVisible({ timeout: 2000 });
  }).toPass();
});

test("event analytics bagikan: token sah → 204, token/isi salah ditolak", async ({ page }) => {
  await signInFast(page, uniqueEmail("event"));
  const group = await createGroupViaApi(page, "Grup Event");
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: [], costs: { courtPerHour: null, shuttle: null } },
  });
  const { data } = await admin().from("sessions").select("share_token").eq("id", (await created.json()).id).single();
  const send = (body: Record<string, unknown>) => page.request.post("/api/events", { data: body });
  expect((await send({ event: "bill_shared", token: data!.share_token, channel: "whatsapp" })).status()).toBe(204);
  expect((await send({ event: "recap_shared", token: data!.share_token, channel: "download" })).status()).toBe(204);
  expect((await send({ event: "recap_shared", token: "0".repeat(32), channel: "download" })).status()).toBe(404);
  expect((await send({ event: "session_created", token: data!.share_token, channel: "whatsapp" })).status()).toBe(400);
});
