import { describe, expect, it } from "vitest";
import { isWebUrl, mapsUrl, roundCoord } from "./venue";

describe("mapsUrl", () => {
  it("tautan yang ditempel didahulukan; titik → Google Maps; tanpa lokasi → null", () => {
    expect(mapsUrl({ url: "https://maps.app.goo.gl/abc", lat: -6.2, lng: 106.8 })).toBe("https://maps.app.goo.gl/abc");
    expect(mapsUrl({ url: null, lat: -6.1753924, lng: 106.8271528 })).toBe("https://www.google.com/maps/search/?api=1&query=-6.175392,106.827153");
    expect(mapsUrl({ url: null, lat: null, lng: null })).toBeNull();
    expect(mapsUrl({ url: null, lat: -6.2, lng: null })).toBeNull();
  });
});

describe("isWebUrl & roundCoord", () => {
  it("hanya http/https", () => {
    for (const ok of ["https://maps.app.goo.gl/x", "http://maps.google.com/?q=GOR"]) expect(isWebUrl(ok)).toBe(true);
    for (const bad of ["javascript:alert(1)", "maps.google.com", "", "ftp://x.y"]) expect(isWebUrl(bad)).toBe(false);
  });

  it("6 desimal", () => {
    expect(roundCoord(106.82715284)).toBe(106.827153);
    expect(roundCoord(-6.1)).toBe(-6.1);
  });
});
