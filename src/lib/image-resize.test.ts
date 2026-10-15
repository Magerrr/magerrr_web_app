import { describe, expect, it } from "vitest";
import { fitBox } from "./image-resize";

describe("fitBox", () => {
  it("memperkecil sisi terpanjang ke batas, rasio tetap", () => {
    expect(fitBox(4000, 3000, { max: 1600 })).toEqual({ src: { x: 0, y: 0, w: 4000, h: 3000 }, dst: { w: 1600, h: 1200 } });
  });

  it("tidak memperbesar gambar kecil", () => {
    expect(fitBox(800, 600, { max: 1600 }).dst).toEqual({ w: 800, h: 600 });
  });

  it("potong tengah persegi untuk logo", () => {
    expect(fitBox(1200, 800, { max: 512, square: true })).toEqual({ src: { x: 200, y: 0, w: 800, h: 800 }, dst: { w: 512, h: 512 } });
    expect(fitBox(300, 500, { max: 512, square: true })).toEqual({ src: { x: 0, y: 100, w: 300, h: 300 }, dst: { w: 300, h: 300 } });
  });
});
