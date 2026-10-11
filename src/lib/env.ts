// Variabel lingkungan dibaca lazily agar `next build` tidak gagal saat env belum diisi.
// NEXT_PUBLIC_* harus ditulis literal supaya di-inline oleh Next.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Env ${name} belum diisi (lihat .env.example)`);
  return value;
}

export function publicEnv() {
  return {
    siteUrl: required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL),
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function secretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}
