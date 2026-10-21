import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http-error";

vi.mock("server-only", () => ({}));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "http://localhost";

const db = vi.hoisted(() => ({
  isAdmin: false,
  calls: [] as { listed: boolean; actorId: string }[],
}));

vi.mock("../load", () => ({
  adminSession: async () => {
    if (!db.isAdmin) throw new HttpError(403, "Hanya admin grup yang boleh melakukan ini.");
    return { membership: { member: { id: "admin-1" } }, session: { id: SESSION_ID, groupId: GROUP_ID } };
  },
}));
vi.mock("@/lib/db/sessions", () => ({
  setListed: async (_session: unknown, listed: boolean, actorId: string) => void db.calls.push({ listed, actorId }),
}));

import { PUT } from "./route";

const put = (body: unknown) =>
  PUT(
    new Request(`${ORIGIN}/api/groups/${GROUP_ID}/sessions/${SESSION_ID}/listed`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ groupId: GROUP_ID, sessionId: SESSION_ID }) } as never,
  );

beforeEach(() => {
  db.isAdmin = false;
  db.calls = [];
});

describe("PUT /api/groups/[groupId]/sessions/[sessionId]/listed", () => {
  it("403 untuk non-admin dan tidak mengubah apa pun", async () => {
    const res = await put({ listed: false });
    expect(res.status).toBe(403);
    expect(db.calls).toEqual([]);
  });

  it("admin menyembunyikan dan menampilkan sesi, pelaku diteruskan untuk audit_log", async () => {
    db.isAdmin = true;
    const hide = await put({ listed: false });
    expect(hide.status).toBe(200);
    expect(await hide.json()).toEqual({ listed: false });
    await put({ listed: true });
    expect(db.calls).toEqual([
      { listed: false, actorId: "admin-1" },
      { listed: true, actorId: "admin-1" },
    ]);
  });

  it("422/400 untuk payload tidak valid", async () => {
    db.isAdmin = true;
    const res = await put({ listed: "tidak" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(db.calls).toEqual([]);
  });
});
