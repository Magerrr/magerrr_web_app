import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv, secretKey } from "@/lib/env";
import type { Database } from "./database.types";

/** Klien untuk Supabase Auth saja (sesi di cookie). Data dibaca lewat `serviceClient`. */
export async function createAuthClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component: cookie tidak bisa ditulis; proxy.ts yang menyegarkan sesi.
        }
      },
    },
  });
}

/**
 * Klien service role: melewati RLS, jadi hanya dipakai setelah authz (src/lib/db/authz.ts).
 * `actorMemberId` diteruskan sebagai header agar trigger audit mencatat pelakunya.
 */
export function serviceClient(actorMemberId?: string) {
  return createClient<Database>(publicEnv().supabaseUrl, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: actorMemberId ? { "x-actor-member-id": actorMemberId } : {} },
  });
}
