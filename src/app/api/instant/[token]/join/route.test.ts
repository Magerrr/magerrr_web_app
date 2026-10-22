import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TOKEN = "0123456789abcdef0123456789abcdef";
const ORIGIN = "http://localhost";

const db = vi.hoisted(() => ({
  rpcError: null as null | { message: string; code?: string },
  calls: [] as Record<string, unknown>[],
  cookies: [] as string[],
}));

vi.mock("@/lib/db/authz", () => ({
  setGuestCookie: async (_group: string, token: string) => void db.cookies.push(token),
}));
vi.mock("@/lib/db/supabase", () => ({
  serviceClient: () => ({
    rpc: async (_name: string, args: Record<string, unknown>) => {
      db.calls.push(args);
      if (db.rpcError) return { data: null, error: db.rpcError };
      return { data: [{ group_id: "g1", session_id: "s1", member_id: "m1", claim_token: "claim-rahasia" }], error: null };
    },
  }),
}));

import { POST } from "./route";

const post = (body: unknown, token = TOKEN) =>
  POST(
    new Request(`${ORIGIN}/api/instant/${token}/join`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ token }) } as never,
  );

beforeEach(() => {
  db.rpcError = null;
  db.calls = [];
  db.cookies = [];
});

describe("POST /api/instant/[token]/join", () => {
  it("sukses: 201, memanggil RPC sebagai tamu (p_user null), set cookie claim_token", async () => {
    const res = await post({ display_name: "  Budi " });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ groupId: "g1", sessionId: "s1", memberId: "m1" });
    expect(db.calls).toEqual([{ p_token: TOKEN, p_display_name: "Budi", p_user: null }]);
    expect(db.cookies).toEqual(["claim-rahasia"]);
  });

  it("token bukan hex 128 bit → 404 tanpa memanggil RPC", async () => {
    expect((await post({ display_name: "Budi" }, "tebakan")).status).toBe(404);
    expect(db.calls).toEqual([]);
  });

  it("tanpa display_name → 400", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ display_name: "   " })).status).toBe(400);
    expect(db.calls).toEqual([]);
  });

  it("session_expired → 404 dengan pesan Indonesia, tanpa cookie", async () => {
    db.rpcError = { message: "session_expired", code: "P0001" };
    const res = await post({ display_name: "Budi" });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/kedaluwarsa/);
    expect(db.cookies).toEqual([]);
  });

  it("session_full → 409 dengan pesan Indonesia", async () => {
    db.rpcError = { message: "session_full", code: "P0001" };
    const res = await post({ display_name: "Budi" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/penuh/);
  });

  it("nama kembar di grup (23505) → 409", async () => {
    db.rpcError = { message: "duplicate key", code: "23505" };
    const res = await post({ display_name: "Budi" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/sudah dipakai/);
  });
});
