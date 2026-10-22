import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http-error";

vi.mock("server-only", () => ({}));

const ORIGIN = "http://localhost";
const SESSION = "11111111-1111-4111-8111-111111111111";

const db = vi.hoisted(() => ({
  groupId: "g-1" as string | null,
  member: null as null | { id: string },
  known: true,
  rotateError: null as null | { status: 403 | 404; message: string },
  calls: [] as { sessionId: string; actor: string }[],
}));

vi.mock("@/lib/env", () => ({ publicEnv: () => ({ siteUrl: "https://magerrr.test" }) }));
vi.mock("@/lib/db/authz", () => ({
  requireMember: async () => {
    if (!db.member) throw new HttpError(db.known ? 403 : 401, "Tidak boleh.");
    return { member: db.member };
  },
}));
vi.mock("@/lib/db/sessions", () => ({
  findSessionGroupId: async () => db.groupId,
  rotateInstantToken: async (sessionId: string, actor: string) => {
    if (db.rotateError) throw new HttpError(db.rotateError.status, db.rotateError.message);
    db.calls.push({ sessionId, actor });
    return { shareToken: "tokBaru", expiresAt: new Date("2026-11-01T12:00:00.000Z") };
  },
}));

import { POST } from "./route";

const post = () =>
  POST(
    new Request(`${ORIGIN}/api/sessions/${SESSION}/instant/regenerate`, {
      method: "POST",
      headers: { origin: ORIGIN, host: "localhost" },
    }),
    { params: Promise.resolve({ sessionId: SESSION }) } as never,
  );

beforeEach(() => {
  db.groupId = "g-1";
  db.member = { id: "m-1" };
  db.known = true;
  db.rotateError = null;
  db.calls = [];
});

describe("POST /api/sessions/[sessionId]/instant/regenerate", () => {
  it("404 bila sesi tidak ada", async () => {
    db.groupId = null;
    expect((await post()).status).toBe(404);
    expect(db.calls).toEqual([]);
  });

  it("401 bila pengunjung tak dikenal, 403 bila bukan anggota", async () => {
    db.member = null;
    db.known = false;
    expect((await post()).status).toBe(401);
    db.known = true;
    expect((await post()).status).toBe(403);
    expect(db.calls).toEqual([]);
  });

  it("403 bila anggota bukan host/admin (ditolak RPC)", async () => {
    db.rotateError = { status: 403, message: "Hanya host atau admin yang boleh mengganti tautan." };
    expect((await post()).status).toBe(403);
  });

  it("404 bila RPC melaporkan session_not_found", async () => {
    db.rotateError = { status: 404, message: "Sesi tidak ditemukan." };
    expect((await post()).status).toBe(404);
  });

  it("200 + tautan baru dan expiry; pelaku = id anggota", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shareUrl: "https://magerrr.test/s/tokBaru", expiresAt: "2026-11-01T12:00:00.000Z" });
    expect(db.calls).toEqual([{ sessionId: SESSION, actor: "m-1" }]);
  });
});
