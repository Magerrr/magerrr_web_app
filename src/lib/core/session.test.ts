import { describe, expect, it } from "vitest";
import { MIN_PLAYERS_TO_START, checkTransition } from "./session";

describe("checkTransition (PRD S4: Rencana → Berlangsung → Selesai)", () => {
  it("planned → running butuh minimal 2 peserta hadir", () => {
    expect(MIN_PLAYERS_TO_START).toBe(2);
    expect(checkTransition("planned", "running", 2)).toEqual({ ok: true });
    expect(checkTransition("planned", "running", 1)).toEqual({
      ok: false,
      reason: "Tandai minimal 2 peserta hadir sebelum mulai.",
    });
  });

  it("running → finished", () => {
    expect(checkTransition("running", "finished", 0)).toEqual({ ok: true });
  });

  it("transisi lain ditolak", () => {
    expect(checkTransition("planned", "finished", 8).ok).toBe(false);
    expect(checkTransition("running", "running", 8).ok).toBe(false);
    expect(checkTransition("finished", "running", 8)).toEqual({ ok: false, reason: "Sesi sudah selesai." });
    expect(checkTransition("running", "planned", 8).ok).toBe(false);
  });
});
