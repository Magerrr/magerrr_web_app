import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Nilai dari .env.local (dimuat di playwright.config.ts) — Supabase lokal.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const admin = () =>
  createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export const anon = () =>
  createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });

export const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;

/** Ambil tautan terbaru untuk `email` (opsional: subjek mengandung `subject`) dari Mailpit (SMTP lokal Supabase). */
export async function magicLinkFromMailpit(request: APIRequestContext, email: string, subject = ""): Promise<string> {
  let link = "";
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:"${email}"${subject ? ` subject:"${subject}"` : ""}` } });
        const { messages } = await search.json();
        if (!messages?.length) return "";
        const message = await (await request.get(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json();
        link = (message.HTML.match(/href="([^"]+)"/)?.[1] ?? "").replaceAll("&amp;", "&");
        return link;
      },
      { timeout: 15_000, message: `email masuk untuk ${email}` },
    )
    .toContain("/auth/v1/verify");
  return link;
}

/** Daftar/masuk lewat UI dengan magic link email. */
export async function signInViaEmail(page: Page, email: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Kirim tautan masuk" }).click();
  await expect(page.getByText(`Tautan masuk sudah dikirim ke ${email}`)).toBeVisible();
  await page.goto(await magicLinkFromMailpit(page.request, email));
  await expect(page.getByRole("link", { name: "Profil kamu" })).toBeVisible();
}

/** Masuk cepat tanpa email: user dibuat via admin API, lalu token_hash diverifikasi di /auth/callback. */
export async function signInFast(page: Page, email: string) {
  const created = await admin().auth.admin.createUser({ email, email_confirm: true });
  expect(created.error).toBeNull();
  await signInExisting(page, email);
}

/** Masuk sebagai akun yang sudah ada (mis. akun demo seed). */
export async function signInExisting(page: Page, email: string) {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  expect(error).toBeNull();
  await page.goto(`/auth/callback?token_hash=${data.properties!.hashed_token}&type=magiclink&next=/`);
  await expect(page.getByRole("link", { name: "Profil kamu" })).toBeVisible();
}

/** Buat grup lewat API sebagai pengguna login di `page`; kembalikan id dan kode undangan. */
export async function createGroupViaApi(page: Page, name: string) {
  const response = await page.request.post("/api/groups", { data: { name } });
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  const { data } = await admin().from("groups").select("invite_code").eq("id", id).single();
  return { id: id as string, inviteCode: data!.invite_code as string };
}
