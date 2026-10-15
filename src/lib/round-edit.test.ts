import { describe, expect, it } from "vitest";
import { moveLineup, readSlot, sameSlot, swapSlots, type EditableRound } from "./round-edit";

const round = (): EditableRound => ({
  courts: [
    { courtNo: 1, kind: "doubles", A: ["a", "b"], B: ["c", "d"] },
    { courtNo: 3, kind: "doubles", A: ["e", "f"], B: ["g", "h"] },
  ],
  waiting: ["i", "j"],
});

describe("swapSlots", () => {
  it("menukar pemain antar tim di satu lapangan", () => {
    const next = swapSlots(round(), { court: 0, side: "A", index: 1 }, { court: 0, side: "B", index: 0 });
    expect(next.courts[0]).toMatchObject({ A: ["a", "c"], B: ["b", "d"] });
    expect(next.courts[1]).toEqual(round().courts[1]);
  });

  it("menukar pemain lapangan dengan yang menunggu", () => {
    const next = swapSlots(round(), { court: 1, side: "B", index: 1 }, { court: null, index: 0 });
    expect(next.courts[1].B).toEqual(["g", "i"]);
    expect(next.waiting).toEqual(["h", "j"]);
  });

  it("slot yang sama tidak mengubah apa pun", () => {
    const p = round();
    expect(swapSlots(p, { court: null, index: 1 }, { court: null, index: 1 })).toBe(p);
  });

  it("readSlot dan sameSlot", () => {
    expect(readSlot(round(), { court: 1, side: "A", index: 0 })).toBe("e");
    expect(readSlot(round(), { court: null, index: 1 })).toBe("j");
    expect(sameSlot({ court: 0, side: "A", index: 0 }, { court: 0, side: "B", index: 0 })).toBe(false);
    expect(sameSlot({ court: null, index: 0 }, { court: 0, side: "A", index: 0 })).toBe(false);
  });
});

describe("moveLineup", () => {
  const empty = [1, 2, 3];

  it("memindahkan susunan ke lapangan kosong yang belum dipakai", () => {
    const next = moveLineup(round(), 3, 2, empty);
    expect(next.courts.map((c) => [c.courtNo, c.A[0]])).toEqual([
      [1, "a"],
      [2, "e"],
    ]);
  });

  it("menukar lapangan bila tujuan sudah berisi, hasil urut nomor lapangan", () => {
    const next = moveLineup(round(), 1, 3, empty);
    expect(next.courts.map((c) => [c.courtNo, c.A[0]])).toEqual([
      [1, "e"],
      [3, "a"],
    ]);
  });

  it("menolak lapangan yang tidak kosong, asal yang tidak ada, atau lapangan yang sama", () => {
    const p = round();
    expect(moveLineup(p, 1, 4, empty)).toBe(p);
    expect(moveLineup(p, 2, 1, empty)).toBe(p);
    expect(moveLineup(p, 1, 1, empty)).toBe(p);
  });
});
