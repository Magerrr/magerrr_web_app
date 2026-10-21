import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "http://localhost";

const db = vi.hoisted(() => ({
  session: null as null | { id: string; groupId: string; startsAt: Date; durationMin: number | null; status: "planned" | "running" | "finished" },
  membership: null as null | { member: { id: string; role: "admin" | "referee" | "member" } },
  members: [] as string[],
  going: new Set<string>(),
  cookies: [] as string[],
}));

vi.mock("@/lib/db/authz", () => ({
  getMembership: async () => db.membership,
  getUser: async () => null,
  setGuestCookie: async (_group: string, token: string) => void db.cookies.push(token),
}));
vi.mock("@/lib/db/members", () => ({
  joinGroup: async (_group: string, name: string) => {
    if (!db.members.includes(name)) db.members.push(name);
    return { member: { id: `m-${name}` }, claimToken: "token-rahasia" };
  },
}));
vi.mock("@/lib/db/sessions", () => ({
  findPublicSessionRef: async () => db.session,
  rsvpGoing: async (_session: string, memberId: string) => void db.going.add(memberId),
}));

import { POST } from "./route";

const post = (body?: unknown, id = SESSION_ID) =>
  POST(
    new Request(`${ORIGIN}/api/jelajah/sesi/${id}/ikut`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost" },
      body: JSON.stringify(body ?? {}),
    }),
    { params: Promise.resolve({ sessionId: id }) } as never,
  );

const future = () => new Date(Date.now() + 24 * 3600_000);

beforeEach(() => {
  db.session = { id: SESSION_ID, groupId: GROUP_ID, startsAt: future(), durationMin: 120, status: "planned" };
  db.membership = null;
  db.members = [];
  db.going = new Set();
  db.cookies = [];
});

describe("POST /api/jelajah/sesi/[sessionId]/ikut", () => {
  it("404 untuk sesi tidak ada / grup privat / id bukan UUID, dengan pesan yang sama", async () => {
    db.session = null;
    const hidden = await post({ displayName: "Budi" });
    const invalid = await post({ displayName: "Budi" }, "bukan-uuid");
    expect(hidden.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect((await hidden.json()).error).toBe((await invalid.json()).error);
    expect(db.members).toEqual([]);
  });

  it("422 untuk sesi selesai atau sudah lewat, tanpa menggabungkan siapa pun", async () => {
    db.session!.status = "finished";
    expect((await post({ displayName: "Budi" })).status).toBe(422);
    db.session = { ...db.session!, status: "planned", startsAt: new Date(Date.now() - 5 * 3600_000) };
    expect((await post({ displayName: "Budi" })).status).toBe(422);
    expect(db.members).toEqual([]);
  });

  it("menolak wasit dengan pesan Bahasa Indonesia", async () => {
    db.membership = { member: { id: "m-wasit", role: "referee" } };
    const res = await post();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/Wasit tidak ikut bermain/);
    expect(db.going.size).toBe(0);
  });

  it("bukan anggota: gabung sebagai tamu (cookie claim_token) lalu RSVP going, redirect ke sesi", async () => {
    const res = await post({ displayName: "Budi" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/g/${GROUP_ID}/sesi/${SESSION_ID}`);
    expect(db.cookies).toEqual(["token-rahasia"]);
    expect([...db.going]).toEqual(["m-Budi"]);
  });

  it("bukan anggota tanpa displayName → 400", async () => {
    expect((await post({})).status).toBe(400);
    expect(db.going.size).toBe(0);
  });

  it("sudah anggota: hanya RSVP, tanpa body dan tanpa gabung ulang", async () => {
    db.membership = { member: { id: "m-ani", role: "member" } };
    const res = await post();
    expect(res.status).toBe(303);
    expect(db.members).toEqual([]);
    expect(db.cookies).toEqual([]);
    expect([...db.going]).toEqual(["m-ani"]);
  });

  it("idempoten: dipakai ulang tidak menggandakan anggota maupun RSVP", async () => {
    await post({ displayName: "Budi" });
    await post({ displayName: "Budi" });
    expect(db.members).toEqual(["Budi"]);
    expect(db.going.size).toBe(1);
  });
});
