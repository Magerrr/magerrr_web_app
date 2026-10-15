import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEADOW_HEX } from "./brand";
import { contrastRatio } from "./contrast";
import { GROUP_THEMES, THEME_BG, THEME_HEX, isGroupTheme } from "./group-theme";

const css = readFileSync("src/app/globals.css", "utf8");

describe("warna tema grup", () => {
  it.each(GROUP_THEMES)("%s: teks ink-black di atasnya >= 4.5:1", (theme) => {
    expect(contrastRatio(THEME_HEX[theme], MEADOW_HEX["ink-black"])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GROUP_THEMES)("%s: hex sama dengan token di globals.css", (theme) => {
    const token = THEME_BG[theme].replace(/^bg-/, "");
    expect(css).toContain(`--color-${token}: ${THEME_HEX[theme]};`);
  });

  it("isGroupTheme", () => {
    expect(isGroupTheme("sky")).toBe(true);
    expect(isGroupTheme("ungu")).toBe(false);
  });
});
