import { describe, expect, it } from "vitest";
import { afterGame, fillCourt, isWaiting, reconcileQueue, startRotation, type RotationState } from "./rotation";

const ids = (...n: number[]) => n.map(String);

describe("afterGame — test vector §4.1", () => {
  const doubles: RotationState = {
    courts: [{ A: ids(0, 1), B: ids(2, 3) }],
    queue: ids(4, 5, 6, 7),
  };

  it("ganda, pemenang A → a=[0,1] b=[4,5] queue=[6,7,2,3]", () => {
    expect(afterGame(doubles, 0, "A")).toEqual({
      courts: [{ A: ids(0, 1), B: ids(4, 5) }],
      queue: ids(6, 7, 2, 3),
    });
  });

  it("ganda, pemenang B → b=[2,3] tetap, a=[4,5], queue=[6,7,0,1]", () => {
    expect(afterGame(doubles, 0, "B")).toEqual({
      courts: [{ A: ids(4, 5), B: ids(2, 3) }],
      queue: ids(6, 7, 0, 1),
    });
  });

  it("tunggal, pemenang A → a=[0] b=[2] queue=[3,1]", () => {
    const state = { courts: [{ A: ids(0), B: ids(1) }], queue: ids(2, 3) };
    expect(afterGame(state, 0, "A")).toEqual({ courts: [{ A: ids(0), B: ids(2) }], queue: ids(3, 1) });
  });

  it("6 pemain, A menang → b=[4,5] queue=[2,3]", () => {
    const state = { courts: [{ A: ids(0, 1), B: ids(2, 3) }], queue: ids(4, 5) };
    expect(afterGame(state, 0, "A")).toEqual({ courts: [{ A: ids(0, 1), B: ids(4, 5) }], queue: ids(2, 3) });
  });

  it("tidak mengubah state masukan", () => {
    const before = structuredClone(doubles);
    afterGame(doubles, 0, "A");
    expect(doubles).toEqual(before);
  });
});

describe("afterGame — tambahan", () => {
  it("dua lapangan berbagi satu antrian", () => {
    const state: RotationState = {
      courts: [
        { A: ids(0, 1), B: ids(2, 3) },
        { A: ids(4, 5), B: ids(6, 7) },
      ],
      queue: ids(8, 9),
    };
    const s1 = afterGame(state, 1, "B");
    expect(s1).toEqual({
      courts: [
        { A: ids(0, 1), B: ids(2, 3) },
        { A: ids(8, 9), B: ids(6, 7) },
      ],
      queue: ids(4, 5),
    });
    const s2 = afterGame(s1, 0, "A");
    expect(s2.courts[0]).toEqual({ A: ids(0, 1), B: ids(4, 5) });
    expect(s2.queue).toEqual(ids(2, 3));
  });

  it("antrian kurang dari satu sisi → lapangan menunggu, tanpa error", () => {
    const state: RotationState = { courts: [{ A: ids(0, 1), B: ids(2) }], queue: [] };
    const next = afterGame(state, 0, "A");
    expect(next.courts[0]).toEqual({ A: ids(0, 1), B: [] });
    expect(next.queue).toEqual(ids(2));
    expect(isWaiting(next.courts[0])).toBe(true);
  });

  it("indeks lapangan tidak valid atau lapangan menunggu → RangeError", () => {
    const state: RotationState = { courts: [{ A: ids(0, 1), B: [] }], queue: [] };
    expect(() => afterGame(state, 1, "A")).toThrow(RangeError);
    expect(() => afterGame(state, 0, "A")).toThrow(RangeError);
  });
});

describe("startRotation", () => {
  it("mengisi lapangan berurutan, sisanya antre", () => {
    expect(startRotation(ids(0, 1, 2, 3, 4, 5, 6, 7, 8, 9), 2, "doubles")).toEqual({
      courts: [
        { A: ids(0, 1), B: ids(2, 3) },
        { A: ids(4, 5), B: ids(6, 7) },
      ],
      queue: ids(8, 9),
    });
  });

  it("lapangan yang tak terisi penuh tidak dibuat", () => {
    expect(startRotation(ids(0, 1, 2, 3, 4, 5), 2, "doubles")).toEqual({
      courts: [{ A: ids(0, 1), B: ids(2, 3) }],
      queue: ids(4, 5),
    });
    expect(startRotation(ids(0, 1, 2), 1, "singles")).toEqual({
      courts: [{ A: ids(0), B: ids(1) }],
      queue: ids(2),
    });
    expect(startRotation(ids(0, 1, 2), 1, "doubles")).toEqual({ courts: [], queue: ids(0, 1, 2) });
  });

  it("pemain ganda → RangeError", () => {
    expect(() => startRotation(ids(0, 1, 1, 2), 1, "doubles")).toThrow(RangeError);
  });
});

describe("reconcileQueue", () => {
  it("buang yang tidak hadir atau sedang main, tambah peserta baru di ujung (urutan present)", () => {
    expect(reconcileQueue(ids(4, 5, 6), ids(1, 2, 4, 6, 7, 8), ids(1, 2))).toEqual(ids(4, 6, 7, 8));
    expect(reconcileQueue([], ids(3, 1, 2), [])).toEqual(ids(3, 1, 2));
    expect(reconcileQueue(ids(1, 1, 2), ids(1, 2), [])).toEqual(ids(1, 2));
  });
});

describe("fillCourt", () => {
  it("ambil dua sisi dari kepala antrian", () => {
    expect(fillCourt(ids(4, 5, 6, 7, 8), "doubles")).toEqual({ teams: { A: ids(4, 5), B: ids(6, 7) }, queue: ids(8) });
    expect(fillCourt(ids(4, 5, 6), "singles")).toEqual({ teams: { A: ids(4), B: ids(5) }, queue: ids(6) });
  });

  it("antrian kurang → lapangan tetap kosong", () => {
    expect(fillCourt(ids(4, 5, 6), "doubles")).toEqual({ teams: null, queue: ids(4, 5, 6) });
  });
});
