import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRAND, MEADOW_HEX } from "@/lib/brand";

interface Token {
  name: string;
  value: string;
}

const tokens = JSON.parse(
  readFileSync("docs/design/project/ds/meadow/tokens.json", "utf8"),
) as { color: { tokens: Token[] }; radius: { tokens: Token[] } };
const css = readFileSync("src/app/globals.css", "utf8");

// Nilai alias Meadow "{cream-paper}" menjadi var(--color-cream-paper) di CSS.
const cssValue = (prefix: string, value: string) =>
  value.startsWith("{") ? `var(--${prefix}-${value.slice(1, -1)})` : value.toLowerCase();

describe("token Meadow di globals.css", () => {
  it.each(tokens.color.tokens)("warna $name", ({ name, value }) => {
    expect(css).toContain(`--color-${name}: ${cssValue("color", value)};`);
  });

  it.each(tokens.radius.tokens)("radius $name", ({ name, value }) => {
    expect(css).toContain(`--${name}: ${value};`);
  });

  it("theme-color manifest = cream-paper", () => {
    const cream = tokens.color.tokens.find((t) => t.name === "cream-paper");
    expect(BRAND.themeColor).toBe(cream?.value);
  });

  it.each(Object.entries(MEADOW_HEX))("MEADOW_HEX %s", (name, value) => {
    expect(tokens.color.tokens.find((t) => t.name === name)?.value.toLowerCase()).toBe(value);
  });
});
