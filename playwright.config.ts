import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Kunci Supabase lokal untuk helper test (sama dengan yang dipakai aplikasi).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// E2E memakai build produksi di port tersendiri: tanpa kompilasi on-demand / HMR dev server
// yang bisa memuat ulang halaman di tengah test paralel, dan tidak bentrok dengan `npm run dev`.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
  },
  // Target utama layar 360–430px (PRD §9).
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    // Tautan undangan & magic link harus menunjuk ke server test ini.
    env: { NEXT_PUBLIC_SITE_URL: baseURL },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
