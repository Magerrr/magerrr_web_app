import { describe, expect, it } from "vitest";
import { clampCrop, cropRect, fitBox } from "./image-resize";

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

describe("cropRect", () => {
  it("zoom 1 di tengah = potong tengah persegi sisi terpendek", () => {
    expect(cropRect(1200, 800, { cx: 600, cy: 400, zoom: 1 })).toEqual({ x: 200, y: 0, side: 800 });
  });

  it("zoom memperkecil sisi potongan di sekitar pusat", () => {
    expect(cropRect(1200, 800, { cx: 600, cy: 400, zoom: 2 })).toEqual({ x: 400, y: 200, side: 400 });
  });

  it("potongan tidak keluar dari gambar", () => {
    expect(cropRect(1200, 800, { cx: 0, cy: 9999, zoom: 2 })).toEqual({ x: 0, y: 400, side: 400 });
    expect(cropRect(1200, 800, { cx: 9999, cy: 400, zoom: 1 })).toEqual({ x: 400, y: 0, side: 800 });
  });

  it("zoom dibatasi 1–4", () => {
    expect(cropRect(800, 800, { cx: 400, cy: 400, zoom: 0.5 }).side).toBe(800);
    expect(cropRect(800, 800, { cx: 400, cy: 400, zoom: 10 }).side).toBe(200);
  });
});

describe("clampCrop", () => {
  it("pusat dikembalikan ke dalam batas agar geseran melewati tepi tidak menumpuk", () => {
    expect(clampCrop(1200, 800, { cx: -500, cy: 400, zoom: 1 })).toEqual({ cx: 400, cy: 400, zoom: 1 });
    expect(clampCrop(1200, 800, { cx: 600, cy: 400, zoom: 9 })).toEqual({ cx: 600, cy: 400, zoom: 4 });
  });
});
