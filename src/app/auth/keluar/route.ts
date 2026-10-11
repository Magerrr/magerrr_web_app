import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { createAuthClient } from "@/lib/db/supabase";

/** Keluar dari akun (form POST). Cookie tamu tidak dihapus; cache halaman di perangkat dibersihkan. */
export const POST = route(async (request) => {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  // Hapus salinan halaman (cache service worker / HTTP) milik akun ini di perangkat; cookie tamu tetap.
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
});
