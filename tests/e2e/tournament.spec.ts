import { expect, test } from "@playwright/test";
import { admin, createGroupViaApi, signInFast, uniqueEmail } from "./support";

test("turnamen sistem gugur: buat dari peserta hadir, mulai & selesaikan match, juara, konflik saat hasil diedit", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await signInFast(page, uniqueEmail("cup"));
  const group = await createGroupViaApi(page, "Grup Cup");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id as string];
  for (const name of ["Bima", "Citra", "Dewi", "Eko", "Fajar"]) {
    ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  }
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Cup", courtCount: 2, playMode: "rotasi", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  const pageUrl = `/g/${group.id}/sesi/${sessionId}/turnamen`;

  // Dari halaman sesi → form turnamen (ganda, pasangan otomatis): 6 pemain → 3 pasangan, bagan 4, 1 bye.
  await page.goto(`/g/${group.id}/sesi/${sessionId}`);
  await page.getByRole("link", { name: "Buat turnamen" }).click();
  await expect(page.getByTestId("tournament-preview")).toHaveText("3 pasangan · bagan 4 · 2 babak · 1 lolos otomatis (bye) ke babak 2");
  await page.getByLabel("Nama turnamen").fill("Jumat Cup");
  await page.getByRole("button", { name: "Buat turnamen" }).click();
  await expect(page.getByRole("heading", { name: "Jumat Cup" })).toBeVisible();
  await expect(page.getByTestId("bracket-slot-1-0")).toContainText("Bye");

  const { data: tournament } = await admin().from("tournaments").select("id, kind, tournament_entries(seed, player1, player2)").eq("session_id", sessionId).single();
  expect(tournament!.kind).toBe("doubles");
  expect(tournament!.tournament_entries).toHaveLength(3);
  expect(new Set(tournament!.tournament_entries.flatMap((e) => [e.player1, e.player2]))).toEqual(new Set(ids));
  const { data: audit } = await admin().from("audit_log").select("action").eq("entity", "tournament").eq("entity_id", tournament!.id);
  expect(audit).toEqual([{ action: "create" }]);
  expect((await page.request.post(`${api}/tournament`, { data: { name: "Lagi", seeding: "rating", entries: { mode: "singles", memberIds: ids.slice(0, 2) } } })).status()).toBe(409);

  // Sesi belum dimulai → tidak bisa memulai match.
  expect((await page.request.post(`${api}/tournament/matches`, { data: { round: 1, slot: 1, courtNo: 1 } })).status()).toBe(422);
  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);

  // Jadwal: semifinal 2 (seed 2 vs 3) siap → mulai di lapangan 1 → papan skor menandai match turnamen.
  await page.goto(`${pageUrl}?tab=jadwal`);
  const item = (name: string) => page.getByTestId("schedule-item").filter({ has: page.getByRole("heading", { name, exact: true }) });
  const semi = item("Semifinal 2");
  await expect(semi).toContainText("Siap main");
  await semi.getByRole("button", { name: "Mulai match" }).click();
  await expect(page).toHaveURL(new RegExp(`/sesi/${sessionId}/main$`));
  await expect(page.getByTestId("court-1")).toContainText("Turnamen · Semifinal 2");
  // Slot yang sama tidak bisa dimulai dua kali; slot yang belum lengkap tidak bisa dimulai.
  expect((await page.request.post(`${api}/tournament/matches`, { data: { round: 1, slot: 1, courtNo: 2 } })).status()).toBe(409);
  expect((await page.request.post(`${api}/tournament/matches`, { data: { round: 2, slot: 0, courtNo: 2 } })).status()).toBe(409);

  const matchOf = async (round: number) =>
    (await admin().from("matches").select("id, match_players(side, member_id)").eq("tournament_id", tournament!.id).eq("bracket_round", round).neq("status", "void").single()).data!;
  const semiMatch = await matchOf(1);
  expect((await page.request.post(`${api}/matches/${semiMatch.id}/complete`, { data: { games: [{ a: 21, b: 15 }] } })).status()).toBe(200);
  // Mode rotasi: match turnamen tidak memicu match rotasi berikutnya di lapangan itu.
  expect((await admin().from("matches").select("id").eq("session_id", sessionId).eq("status", "running")).data).toEqual([]);

  // Pemain match turnamen tidak bisa diganti lewat edit hasil.
  const sideOf = (m: typeof semiMatch, side: string) => m.match_players.filter((p) => p.side === side).map((p) => p.member_id);
  const swapped = [sideOf(semiMatch, "B")[0], sideOf(semiMatch, "A")[1]];
  expect((await page.request.patch(`${api}/matches/${semiMatch.id}`, { data: { kind: "doubles", courtNo: 1, A: swapped, B: [sideOf(semiMatch, "A")[0], sideOf(semiMatch, "B")[1]], games: [{ a: 21, b: 15 }] } })).status()).toBe(422);

  // Final: seed 1 (bye) vs pemenang semifinal 2.
  expect((await page.request.post(`${api}/tournament/matches`, { data: { round: 2, slot: 0, courtNo: 2 } })).status()).toBe(201);
  const finalMatch = await matchOf(2);
  expect(new Set(sideOf(finalMatch, "B"))).toEqual(new Set(sideOf(semiMatch, "A")));
  expect((await page.request.post(`${api}/matches/${finalMatch.id}/complete`, { data: { games: [{ a: 18, b: 21 }] } })).status()).toBe(200);

  await page.goto(pageUrl);
  const championNames = (await admin().from("members").select("display_name").in("id", sideOf(semiMatch, "A"))).data!.map((m) => m.display_name);
  await expect(page.getByTestId("tournament-champion")).toContainText(championNames[0]);
  await page.getByRole("link", { name: "Klasemen" }).click();
  const standings = page.getByTestId("tournament-standings").locator("li");
  await expect(standings).toHaveCount(3);
  await expect(standings.nth(0)).toContainText("Juara");
  await expect(standings.nth(0)).toContainText("2–0");
  await expect(standings.nth(1)).toContainText("Finalis");
  await expect(standings.nth(2)).toContainText("Kalah di semifinal");
  // Turnamen yang sudah dimainkan tidak bisa dihapus.
  expect((await page.request.delete(`${api}/tournament`)).status()).toBe(422);

  // Halaman publik (tanpa login) lewat token sesi.
  const { data: s } = await admin().from("sessions").select("share_token").eq("id", sessionId).single();
  const visitor = await (await browser.newContext({ baseURL })).newPage();
  await visitor.goto(`/s/${s!.share_token}/turnamen`);
  await expect(visitor.getByRole("heading", { name: "Jumat Cup" })).toBeVisible();
  await expect(visitor.getByTestId("bracket-champion")).toContainText(championNames[0]);
  await visitor.context().close();

  // Hasil semifinal diedit sehingga pemenangnya berubah → final tidak cocok lagi dengan bagan.
  expect((await page.request.patch(`${api}/matches/${semiMatch.id}`, { data: { kind: "doubles", courtNo: 1, A: sideOf(semiMatch, "A"), B: sideOf(semiMatch, "B"), games: [{ a: 10, b: 21 }] } })).status()).toBe(200);
  await page.goto(`${pageUrl}?tab=jadwal`);
  await expect(item("Final")).toContainText("Perlu dicek");
  await expect(page.getByTestId("tournament-champion")).toHaveCount(0);
  // Batalkan final → slot final siap dimainkan ulang dengan pemenang baru.
  expect((await page.request.post(`${api}/matches/${finalMatch.id}/void`)).status()).toBe(200);
  await page.reload();
  await expect(item("Final")).toContainText("Siap main");
});

test("turnamen: validasi peserta & hapus turnamen yang belum dimainkan", async ({ page }) => {
  await signInFast(page, uniqueEmail("cup2"));
  const group = await createGroupViaApi(page, "Grup Cup 2");
  const { data: hostRow } = await admin().from("members").select("id").eq("group_id", group.id).single();
  const ids = [hostRow!.id as string];
  for (const name of ["q2", "q3", "q4", "q5"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: null, courtCount: 1, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: ids.slice(0, 4), costs: { courtPerHour: null, shuttle: null } },
  });
  const api = `/api/groups/${group.id}/sessions/${(await created.json()).id}/tournament`;
  const post = (entries: unknown) => page.request.post(api, { data: { name: "Cup", seeding: "random", entries } });
  expect((await post({ mode: "pairs_auto", memberIds: [...ids.slice(0, 3), ids[0]] })).status()).toBe(422); // pemain dobel
  expect((await post({ mode: "singles", memberIds: [ids[0], ids[4]] })).status()).toBe(422); // tidak hadir
  expect((await post({ mode: "pairs", pairs: [[ids[0], ids[1]], [ids[1], ids[2]]] })).status()).toBe(422);
  expect((await post({ mode: "pairs_auto", memberIds: [...ids.slice(0, 4), ids[4]] })).status()).toBe(422); // ganjil + tidak hadir
  expect((await post({ mode: "singles", memberIds: ids.slice(0, 4) })).status()).toBe(201);
  expect((await page.request.delete(api)).status()).toBe(204);
  expect((await page.request.delete(api)).status()).toBe(404);
  const { data: audit } = await admin().from("audit_log").select("action").eq("group_id", group.id).eq("entity", "tournament").order("id");
  expect(audit).toEqual([{ action: "create" }, { action: "delete" }]);
});

test("turnamen round robin: semua bertemu semua, klasemen dengan adu langsung, juara setelah partai terakhir", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await signInFast(page, uniqueEmail("liga"));
  const group = await createGroupViaApi(page, "Grup Liga");
  const ids: string[] = [];
  for (const name of ["Raka", "Sari", "Tono", "Umi"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: "GOR Liga", courtCount: 2, playMode: "kocok", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;

  // Form: tunggal, round robin → 4 pemain · 6 match · 3 ronde.
  await page.goto(`/g/${group.id}/sesi/${sessionId}/turnamen`);
  await page.getByText("Round robin", { exact: true }).click();
  await page.getByText("Tunggal", { exact: true }).click();
  await expect(page.getByTestId("tournament-preview")).toHaveText("4 pemain · 6 match · 3 ronde");
  await page.getByLabel("Nama turnamen").fill("Liga Jumat");
  await page.getByRole("button", { name: "Buat turnamen" }).click();
  await expect(page.getByRole("heading", { name: "Liga Jumat" })).toBeVisible();
  await expect(page.getByTestId("pool-table").locator("li")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "Bagan" })).toHaveCount(0);

  const { data: tournament } = await admin().from("tournaments").select("id, format, tournament_entries(seed, player1, group_no)").eq("session_id", sessionId).single();
  expect(tournament!.format).toBe("round_robin");
  expect(tournament!.tournament_entries.every((e) => e.group_no === null)).toBe(true);
  const memberOf = Object.fromEntries(tournament!.tournament_entries.map((e) => [e.seed, e.player1]));
  const { data: audit } = await admin().from("audit_log").select("after").eq("entity", "tournament").eq("entity_id", tournament!.id).single();
  expect(audit!.after).toMatchObject({ format: "round_robin", group_count: null });

  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  // Seed 1 menang semua; 2, 3, 4 saling mengalahkan (menang 1, selisih gim sama) → urut selisih poin: 2 (−2), 3 (−6), 4 (−12).
  const results: [number, number, number, number][] = [
    [1, 2, 21, 5],
    [1, 3, 21, 19],
    [1, 4, 21, 19],
    [2, 3, 19, 21],
    [2, 4, 21, 5],
    [3, 4, 15, 21],
  ];
  for (const [i, [a, b, sa, sb]] of results.entries()) {
    const started = await page.request.post(`${api}/tournament/matches`, { data: { a, b, courtNo: 1 } });
    expect(started.status()).toBe(201);
    const { id } = await started.json();
    if (i === 0) {
      // Pasangan yang sama tidak bisa dimulai dua kali; urutan seed harus a < b.
      expect((await page.request.post(`${api}/tournament/matches`, { data: { a, b, courtNo: 2 } })).status()).toBe(409);
      expect((await page.request.post(`${api}/tournament/matches`, { data: { a: b, b: a, courtNo: 2 } })).status()).toBe(400);
      // Pemain yang sedang main → tidak bisa dimulai di lapangan lain.
      expect((await page.request.post(`${api}/tournament/matches`, { data: { a: 1, b: 3, courtNo: 2 } })).status()).toBe(409);
      await page.goto(`/g/${group.id}/sesi/${sessionId}/main`);
      await expect(page.getByTestId("court-1")).toContainText("Turnamen · Round robin");
    }
    expect((await page.request.post(`${api}/matches/${id}/complete`, { data: { games: [{ a: sa, b: sb }] } })).status()).toBe(200);
    if (i === results.length - 2) {
      await page.goto(`/g/${group.id}/sesi/${sessionId}/turnamen`);
      await expect(page.getByTestId("pool-table")).toContainText("Sementara");
      await expect(page.getByTestId("tournament-champion")).toHaveCount(0);
    }
  }

  const name = async (seed: number) => (await admin().from("members").select("display_name").eq("id", memberOf[seed]).single()).data!.display_name as string;
  await page.goto(`/g/${group.id}/sesi/${sessionId}/turnamen`);
  await expect(page.getByTestId("tournament-champion")).toContainText(await name(1));
  const rows = page.getByTestId("pool-table").locator("li");
  await expect(rows.nth(0)).toContainText("Juara");
  await expect(rows.nth(0)).toContainText("3–0");
  expect(await rows.locator("span.truncate").allTextContents()).toEqual([await name(1), await name(2), await name(3), await name(4)]);

  await page.getByRole("link", { name: "Jadwal" }).click();
  await expect(page.getByTestId("schedule-item")).toHaveCount(6);
  await expect(page.getByTestId("schedule-item").first()).toContainText("Partai 1");
  await expect(page.getByTestId("schedule-item").first()).toContainText("Ronde 1");

  const { data: s } = await admin().from("sessions").select("share_token").eq("id", sessionId).single();
  const visitor = await (await browser.newContext({ baseURL })).newPage();
  await visitor.goto(`/s/${s!.share_token}/turnamen`);
  await expect(visitor.getByText(`Round robin · 4 pemain · Juara: ${await name(1)}`)).toBeVisible();
  await expect(visitor.getByTestId("pool-table").locator("li")).toHaveCount(4);
  await visitor.context().close();
});

test("turnamen grup + gugur: grup ular, bagan terisi setelah grup selesai, juara & klasemen akhir", async ({ page }) => {
  test.setTimeout(120_000);
  await signInFast(page, uniqueEmail("grup"));
  const group = await createGroupViaApi(page, "Grup Piala");
  const ids: string[] = [];
  for (const name of ["G1", "G2", "G3", "G4", "G5", "G6"]) ids.push((await (await page.request.post(`/api/groups/${group.id}/members`, { data: { displayName: name } })).json()).id);
  const created = await page.request.post(`/api/groups/${group.id}/sessions`, {
    data: { date: "2026-10-09", time: "19:00", durationMin: 120, venue: null, courtCount: 2, playMode: "rotasi", rules: null, matchGames: null, note: null, attendeeIds: ids, costs: { courtPerHour: null, shuttle: null } },
  });
  const sessionId = (await created.json()).id as string;
  const api = `/api/groups/${group.id}/sessions/${sessionId}`;
  const pageUrl = `/g/${group.id}/sesi/${sessionId}/turnamen`;

  // Validasi format: grup wajib & jumlah minimal.
  const create = (data: object) => page.request.post(`${api}/tournament`, { data: { name: "Piala", seeding: "random", entries: { mode: "singles", memberIds: ids }, ...data } });
  expect((await create({ format: "groups_knockout" })).status()).toBe(400);
  expect((await create({ format: "groups_knockout", groups: { count: 4, advance: 1 } })).status()).toBe(422);
  expect((await create({ format: "round_robin", groups: { count: 2, advance: 1 } })).status()).toBe(400);

  // Form: 6 pemain tunggal, 2 grup, juara grup lolos → final.
  await page.goto(pageUrl);
  await page.getByText("Grup + gugur", { exact: true }).click();
  await page.getByText("Tunggal", { exact: true }).click();
  await page.getByText("Juara grup", { exact: true }).click();
  await expect(page.getByTestId("tournament-preview")).toHaveText("6 pemain · 2 grup (3, 3) · 6 match fase grup · 2 lolos ke final");
  await page.getByLabel("Nama turnamen").fill("Piala Grup");
  await page.getByRole("button", { name: "Buat turnamen" }).click();
  await expect(page.getByRole("heading", { name: "Piala Grup" })).toBeVisible();
  await expect(page.getByTestId("tournament-groups").getByRole("heading", { name: "Grup A" })).toBeVisible();
  await expect(page.getByTestId("tournament-groups").getByRole("heading", { name: "Grup B" })).toBeVisible();

  const { data: tournament } = await admin()
    .from("tournaments")
    .select("id, format, group_count, advance_count, tournament_entries(seed, player1, group_no)")
    .eq("session_id", sessionId)
    .single();
  expect(tournament).toMatchObject({ format: "groups_knockout", group_count: 2, advance_count: 1 });
  // Ular: seed 1,4,5 → grup A; 2,3,6 → grup B.
  const entries = [...tournament!.tournament_entries].sort((x, y) => x.seed - y.seed);
  expect(entries.map((e) => e.group_no)).toEqual([1, 2, 2, 1, 1, 2]);
  const nameOf = async (seed: number) => (await admin().from("members").select("display_name").eq("id", entries[seed - 1].player1).single()).data!.display_name as string;

  await page.getByRole("link", { name: "Bagan" }).click();
  await expect(page.getByTestId("bracket-slot-1-0")).toContainText("Juara Grup A");
  await expect(page.getByTestId("bracket-slot-1-0")).toContainText("Juara Grup B");

  expect((await page.request.post(`${api}/status`, { data: { status: "running" } })).status()).toBe(200);
  const play = async (data: object, games: { a: number; b: number }[]) => {
    const started = await page.request.post(`${api}/tournament/matches`, { data: { ...data, courtNo: 1 } });
    expect(started.status()).toBe(201);
    const { id } = await started.json();
    expect((await page.request.post(`${api}/matches/${id}/complete`, { data: { games } })).status()).toBe(200);
    return id as string;
  };
  // Pasangan lintas grup tidak ada; final belum bisa sebelum grup selesai.
  expect((await page.request.post(`${api}/tournament/matches`, { data: { a: 1, b: 2, courtNo: 1 } })).status()).toBe(404);
  expect((await page.request.post(`${api}/tournament/matches`, { data: { round: 1, slot: 0, courtNo: 1 } })).status()).toBe(409);

  // Grup A (1, 4, 5): 4 menang semua. Grup B (2, 3, 6): 2 menang semua.
  await play({ a: 1, b: 4 }, [{ a: 15, b: 21 }]);
  await play({ a: 4, b: 5 }, [{ a: 21, b: 12 }]);
  await play({ a: 1, b: 5 }, [{ a: 21, b: 18 }]);
  await page.goto(pageUrl);
  await expect(page.getByTestId("tournament-groups").getByTestId("pool-table").first()).toContainText("Lolos");
  await play({ a: 2, b: 3 }, [{ a: 21, b: 11 }]);
  await play({ a: 2, b: 6 }, [{ a: 21, b: 16 }]);
  // Mode rotasi: match turnamen tidak memutar antrian.
  expect((await admin().from("matches").select("id").eq("session_id", sessionId).eq("status", "running")).data).toEqual([]);
  await page.goto(`${pageUrl}?tab=jadwal`);
  const final = page.getByTestId("schedule-item").filter({ has: page.getByRole("heading", { name: "Final", exact: true }) });
  await expect(final).toContainText("Menunggu");
  await play({ a: 3, b: 6 }, [{ a: 21, b: 19 }]);

  await page.reload();
  await expect(final).toContainText("Siap main");
  await expect(final).toContainText(await nameOf(4));
  await expect(final).toContainText(await nameOf(2));
  await final.getByRole("button", { name: "Mulai match" }).click();
  await expect(page).toHaveURL(new RegExp(`/sesi/${sessionId}/main$`));
  await expect(page.getByTestId("court-1")).toContainText("Turnamen · Final");
  const { data: finalMatch } = await admin().from("matches").select("id, entry_a, bracket_round").eq("tournament_id", tournament!.id).eq("bracket_round", 1).single();
  expect(finalMatch!.entry_a).toBeNull();
  expect((await page.request.post(`${api}/matches/${finalMatch!.id}/complete`, { data: { games: [{ a: 21, b: 17 }] } })).status()).toBe(200);

  await page.goto(pageUrl);
  await expect(page.getByTestId("tournament-champion")).toContainText(await nameOf(4));
  await page.getByRole("link", { name: "Klasemen" }).click();
  const standings = page.getByTestId("tournament-standings").locator("li");
  await expect(standings).toHaveCount(6);
  await expect(standings.nth(0)).toContainText("Juara");
  await expect(standings.nth(0)).toContainText("3–0");
  await expect(standings.nth(1)).toContainText("Finalis");
  await expect(standings.nth(2)).toContainText("Gugur di fase grup · peringkat 2 Grup");
  await expect(standings.nth(4)).toContainText("peringkat 3 Grup");
  expect((await page.request.delete(`${api}/tournament`)).status()).toBe(422);
});
