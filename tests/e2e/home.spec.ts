import { expect, test } from "@playwright/test";

test("beranda tampil dalam bahasa Indonesia dengan gaya Meadow", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk untuk buat grup" })).toBeVisible();

  const body = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { background: s.backgroundColor, color: s.color, font: s.fontFamily };
  });
  expect(body.background).toBe("rgb(245, 241, 228)"); // cream-paper
  expect(body.color).toBe("rgb(44, 46, 42)"); // ink-black
  expect(body.font).toMatch(/Inter/i);
});

test("manifest PWA tersedia", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "Magerrr", lang: "id", display: "standalone" });

  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});
