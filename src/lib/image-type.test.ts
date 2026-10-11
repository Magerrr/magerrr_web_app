import { describe, expect, it } from "vitest";
import { imageType } from "./image-type";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe("imageType", () => {
  it("mengenali PNG, JPEG, WebP dari byte awal", () => {
    expect(imageType(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("image/png");
    expect(imageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(imageType(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp");
  });

  it("menolak selain itu", () => {
    expect(imageType(bytes("<svg"))).toBeNull();
    expect(imageType(bytes("GIF89a"))).toBeNull();
    expect(imageType(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeNull();
    expect(imageType(new Uint8Array())).toBeNull();
  });
});
