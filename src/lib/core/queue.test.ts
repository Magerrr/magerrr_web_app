import { describe, expect, it } from "vitest";
import { matchMinutes, restingPriority, rotationTurns, turnEta } from "./queue";

describe("antrian giliran — test vector §4.4", () => {
  it("rotationTurns: dua per giliran untuk ganda, satu untuk tunggal", () => {
    expect(rotationTurns(["p1", "p2", "p3", "p4", "p5"], "doubles")).toEqual([0, 0, 1, 1, 2]);
    expect(rotationTurns(["p1", "p2", "p3"], "singles")).toEqual([0, 1, 2]);
  });

  it("matchMinutes: median durasi dalam [3, 90]", () => {
    expect(matchMinutes([12, 1, 14, 200, 16])).toBe(14);
    expect(matchMinutes([10, 15])).toBe(13);
    expect(matchMinutes([1, 2])).toBeNull();
  });

  it("turnEta: waktu selesai ke-k dari gabungan lapangan", () => {
    expect(turnEta([5, 12], 15, 4)).toEqual([3, 10, 18, 25]);
    expect(turnEta([20], 15, 2)).toEqual([0, 15]);
    expect(turnEta([], 15, 2)).toEqual([null, null]);
    expect(turnEta([5], null, 1)).toEqual([null]);
  });

  it("restingPriority: paling sedikit main, lalu paling lama istirahat, lalu urutan masukan", () => {
    const items = [
      { id: "a", playedThisSession: 2, roundsSinceLastPlayed: 0 },
      { id: "b", playedThisSession: 1, roundsSinceLastPlayed: 1 },
      { id: "c", playedThisSession: 1, roundsSinceLastPlayed: 3 },
      { id: "d", playedThisSession: 2, roundsSinceLastPlayed: 2 },
    ];
    expect(restingPriority(items).map((x) => x.id)).toEqual(["c", "b", "d", "a"]);
    expect(items.map((x) => x.id)).toEqual(["a", "b", "c", "d"]); // masukan tidak diubah
  });

  it("restingPriority: seri penuh → urutan masukan", () => {
    const items = ["z", "y", "x"].map((id) => ({ id, playedThisSession: 0, roundsSinceLastPlayed: 1 }));
    expect(restingPriority(items).map((x) => x.id)).toEqual(["z", "y", "x"]);
  });
});
