import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http-error";

vi.mock("server-only", () => ({}));

const ORIGIN = "http://localhost";

const db = vi.hoisted(() => ({
  user: null as null | { id: string },
  calls: [] as { host: string; input: { slotCount: number } }[],
}));

vi.mock("@/lib/env", () => ({ publicEnv: () => ({ siteUrl: "https://magerrr.test" }) }));
vi.mock("@/lib/db/authz", () => ({
  requireUser: async () => {
    if (!db.user) throw new HttpError(401, "Masuk dulu untuk melanjutkan.");
    return db.user;
  },
}));
vi.mock("@/lib/db/sessions", () => ({
  createInstantSession: async (host: string, input: { slotCount: number }) => {
    db.calls.push({ host, input });
    return { groupId: "g-1", sessionId: "s-1", shareToken: "tok123" };
  },
}));

import { POST } from "./route";

const valid = {
  date: "2026-11-01",
  time: "19:00",
  durationMin: 120,
  venue: "GOR Mawar",
  courtCount: 2,
  playMode: "kocok",
  slotCount: 8,
};

const post = (body: unknown, contentType = "application/json") =>
  POST(
    new Request(`${ORIGIN}/api/sessions/instant`, {
      method: "POST",
      headers: { "content-type": contentType, origin: ORIGIN, host: "localhost" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {} as never,
  );

beforeEach(() => {
  db.user = { id: "user-1" };
  db.calls = [];
});

describe("POST /api/sessions/instant", () => {
  it("401 bila belum login, tanpa membuat sesi", async () => {
    db.user = null;
    expect((await post(valid)).status).toBe(401);
    expect(db.calls).toEqual([]);
  });

  it("400 untuk payload tidak valid (slot kurang, field asing, JSON rusak)", async () => {
    expect((await post({ ...valid, slotCount: 1 })).status).toBe(400);
    expect((await post({ ...valid, isListed: true })).status).toBe(400);
    expect((await post("{rusak")).status).toBe(400);
    expect(db.calls).toEqual([]);
  });

  it("415 bila bukan JSON", async () => {
    expect((await post("x", "text/plain")).status).toBe(415);
  });

  it("201 + tautan bagikan; host = pengguna login", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ groupId: "g-1", sessionId: "s-1", shareUrl: "https://magerrr.test/s/tok123" });
    expect(db.calls).toEqual([{ host: "user-1", input: expect.objectContaining({ slotCount: 8 }) }]);
  });
});
