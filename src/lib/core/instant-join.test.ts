import { describe, expect, it } from "vitest";
import { instantJoinErrorMessage, instantJoinState } from "./instant-join";

const now = new Date("2026-10-22T10:00:00Z");
const base = { status: "planned", expiresAt: new Date("2026-10-23T10:00:00Z"), slotCount: 8, taken: 3 };

describe("instantJoinState", () => {
  it("valid bila belum kedaluwarsa dan masih ada slot", () => expect(instantJoinState(base, now)).toBe("valid"));
  it("tanpa batas slot selalu valid", () => expect(instantJoinState({ ...base, slotCount: null, taken: 99 }, now)).toBe("valid"));
  it("expired bila lewat expiry", () =>
    expect(instantJoinState({ ...base, expiresAt: new Date("2026-10-22T09:59:59Z") }, now)).toBe("expired"));
  it("expired bila sesi selesai", () => expect(instantJoinState({ ...base, status: "finished" }, now)).toBe("expired"));
  it("full bila slot terisi sama dengan total", () => expect(instantJoinState({ ...base, taken: 8 }, now)).toBe("full"));
  it("expired lebih diutamakan daripada full", () =>
    expect(instantJoinState({ ...base, taken: 8, status: "finished" }, now)).toBe("expired"));
});

describe("instantJoinErrorMessage", () => {
  it("memetakan session_expired ke 404", () => expect(instantJoinErrorMessage("session_expired")?.status).toBe(404));
  it("memetakan session_full ke 409", () => expect(instantJoinErrorMessage("session_full")?.status).toBe(409));
  it("error lain tidak dipetakan", () => expect(instantJoinErrorMessage("boom")).toBeNull());
});
