import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/db/supabase";
import { safeNextPath } from "@/lib/validation";

/** Tujuan tautan magic link & OAuth: tukar kode menjadi sesi (cookie), lalu lanjut ke `next`. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const supabase = await createAuthClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  // Ganti email (MAGERRR-12): dengan konfirmasi ganda, tautan pertama tidak membawa kode (hanya pesan), dan
  // tautan yang dibuka di perangkat lain tidak bisa ditukar menjadi sesi, padahal email tetap terkonfirmasi.
  const emailChange = next.startsWith("/profil?email=");
  const target = ok ? next : emailChange ? "/profil?email=lanjut" : `/masuk?error=tautan&next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
