import { readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/db/authz";
import { createAuthClient } from "@/lib/db/supabase";
import { publicEnv } from "@/lib/env";
import { HttpError } from "@/lib/http-error";
import { accountEmailSchema } from "@/lib/validation";

/**
 * Minta ganti email (MAGERRR-12). Supabase Auth mengirim tautan konfirmasi; email baru berlaku setelah dikonfirmasi
 * (bila "secure email change" aktif: tautan di email lama dan email baru). Sampai itu, akun tetap memakai email lama.
 */
export const POST = route(async (request) => {
  const user = await requireUser();
  const { email } = await readJson(request, accountEmailSchema);
  if (email === user.email?.toLowerCase()) throw new HttpError(422, "Itu sudah email akunmu.");

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${publicEnv().siteUrl}/auth/callback?next=${encodeURIComponent("/profil?email=terkonfirmasi")}` },
  );
  if (error) {
    if (error.code === "email_exists") throw new HttpError(409, "Email ini sudah dipakai akun lain.");
    if (error.status === 429) throw new HttpError(429, "Terlalu sering meminta. Tunggu sebentar lalu coba lagi.");
    throw error;
  }
  return Response.json({ email }, { status: 202 });
});
