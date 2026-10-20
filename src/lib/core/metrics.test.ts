import { describe, expect, it } from "vitest";
import { groupMetrics, median, metricsFrom, summarize, weekStartWib, type SessionMetricInput } from "./metrics";

const d = (s: string) => new Date(s);
const base: SessionMetricInput = {
  startsAt: d("2026-10-14T12:00:00Z"),
  finished: true,
  createdAt: d("2026-10-14T10:00:00Z"),
  finishedAt: d("2026-10-14T12:00:00Z"),
  hasScore: true,
  hasBill: true,
  recapShared: true,
  nonHostPlayers: 4,
  nonHostOpeners: 2,
};

describe("median", () => {
  it("kosong, ganjil, genap", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("weekStartWib", () => {
  it("Senin 00:00 WIB (= Minggu 17:00 UTC)", () => {
    expect(weekStartWib(d("2026-10-14T12:00:00Z")).toISOString()).toBe("2026-10-11T17:00:00.000Z");
  });
  it("Minggu malam WIB masih pekan yang sama; Senin dini hari WIB pekan baru", () => {
    expect(weekStartWib(d("2026-10-18T16:59:00Z")).toISOString()).toBe("2026-10-11T17:00:00.000Z");
    expect(weekStartWib(d("2026-10-18T17:00:00Z")).toISOString()).toBe("2026-10-18T17:00:00.000Z");
  });
});

describe("summarize", () => {
  it("tanpa data → null", () => {
    expect(summarize([])).toEqual({
      sessions: 0, finishedSessions: 0, withScore: null, withBill: null, recapShared: null, openedLink: null, medianMinutesToClose: null,
    });
  });
  it("rasio dari sesi selesai; sesi belum selesai tidak masuk penyebut", () => {
    const s = summarize([
      base,
      { ...base, hasScore: false, hasBill: false, recapShared: false, nonHostOpeners: 0, finishedAt: d("2026-10-14T11:00:00Z") },
      { ...base, finished: false, finishedAt: null },
    ]);
    expect(s.sessions).toBe(3);
    expect(s.finishedSessions).toBe(2);
    expect(s.withScore).toBe(0.5);
    expect(s.withBill).toBe(0.5);
    expect(s.recapShared).toBe(0.5);
    expect(s.openedLink).toBe(2 / 8);
    expect(s.medianMinutesToClose).toBe(90);
  });
  it("pembuka dibatasi jumlah peserta non-host", () => {
    expect(summarize([{ ...base, nonHostPlayers: 2, nonHostOpeners: 9 }]).openedLink).toBe(1);
  });
  it("durasi negatif atau tanpa waktu diabaikan", () => {
    const s = summarize([{ ...base, finishedAt: d("2026-10-14T09:00:00Z") }, { ...base, createdAt: null }]);
    expect(s.medianMinutesToClose).toBeNull();
  });
});

describe("groupMetrics", () => {
  const now = d("2026-10-20T03:00:00Z"); // Selasa WIB
  it("8 pekan, terbaru di atas, sesi di luar rentang tak dihitung", () => {
    const old = { ...base, startsAt: d("2026-08-01T12:00:00Z") };
    const r = groupMetrics([base, old], now);
    expect(r.weeks).toHaveLength(8);
    expect(r.weeks[0]!.weekStart.toISOString()).toBe("2026-10-18T17:00:00.000Z");
    expect(r.weeks[1]!.sessions).toBe(1);
    expect(r.total.sessions).toBe(1);
  });
  it("sesi 8 pekan lalu masih masuk, 9 pekan lalu tidak", () => {
    const edge = { ...base, startsAt: d("2026-09-01T12:00:00Z") };
    expect(groupMetrics([edge], now).total.sessions).toBe(1);
    expect(groupMetrics([{ ...base, startsAt: d("2026-08-25T12:00:00Z") }], now).total.sessions).toBe(0);
    expect(metricsFrom(now).toISOString()).toBe("2026-08-30T17:00:00.000Z");
  });
});
