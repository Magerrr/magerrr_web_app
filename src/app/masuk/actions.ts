"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/db/supabase";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/validation";

export type EmailState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

const callbackUrl = (next: string) =>
  `${publicEnv().siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

/** Kirim magic link. Akun dibuat otomatis bila email baru. */
export async function sendMagicLink(_prev: EmailState, form: FormData): Promise<EmailState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { status: "error", message: "Alamat email tidak valid." };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: callbackUrl(safeNextPath(form.get("next"))) },
  });
  if (error) {
    return {
      status: "error",
      message:
        error.status === 429
          ? "Terlalu sering meminta tautan. Tunggu sebentar lalu coba lagi."
          : "Tautan belum bisa dikirim. Coba lagi.",
    };
  }
  return { status: "sent", email: email.data };
}

/** Provider dimatikan → Supabase membalas JSON 400 mentah; cek dulu agar pengguna mendapat pesan yang jelas. */
async function googleEnabled(): Promise<boolean> {
  const { supabaseUrl, supabaseKey } = publicEnv();
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
    const settings = await response.json();
    return settings?.external?.google === true;
  } catch {
    return false;
  }
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNextPath(form.get("next"));
  if (!(await googleEnabled())) redirect(`/masuk?error=google&next=${encodeURIComponent(next)}`);
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) redirect(`/masuk?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
