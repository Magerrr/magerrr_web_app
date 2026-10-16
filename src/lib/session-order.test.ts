import { describe, expect, it } from "vitest";
import { activeSessions } from "./session-order";

const now = new Date("2026-10-16T12:00:00Z");
const at = (iso: string) => new Date(iso);
const s = (id: string, status: "planned" | "running" | "finished", iso: string) => ({ id, status, startsAt: at(iso) });

describe("activeSessions", () => {
  it("berlangsung dulu, lalu rencana terdekat; selesai & rencana lewat dibuang", () => {
    const list = [
      s("lusa", "planned", "2026-10-18T12:00:00Z"),
      s("selesai", "finished", "2026-10-16T11:00:00Z"),
      s("besok", "planned", "2026-10-17T12:00:00Z"),
      s("jalan-b", "running", "2026-10-16T11:30:00Z"),
      s("lewat", "planned", "2026-10-16T08:59:59Z"),
      s("jalan-a", "running", "2026-10-16T10:00:00Z"),
      s("baru-mulai", "planned", "2026-10-16T09:00:00Z"),
    ];
    expect(activeSessions(list, now).map((x) => x.id)).toEqual(["jalan-a", "jalan-b", "baru-mulai", "besok", "lusa"]);
  });

  it("jam mulai sama → urutan masukan; daftar kosong aman; masukan tidak diubah", () => {
    const list = [s("x", "planned", "2026-10-17T12:00:00Z"), s("y", "planned", "2026-10-17T12:00:00Z")];
    expect(activeSessions(list, now).map((x) => x.id)).toEqual(["x", "y"]);
    expect(activeSessions([], now)).toEqual([]);
    const input = [s("b", "planned", "2026-10-19T00:00:00Z"), s("a", "planned", "2026-10-18T00:00:00Z")];
    activeSessions(input, now);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
