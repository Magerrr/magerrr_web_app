import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlashToast } from "@/components/toast";
import { Card, Page, SubmitButton, TopBar } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { safeNextPath } from "@/lib/validation";
import { signInWithGoogle } from "./actions";
import { EmailForm } from "./email-form";

export const metadata: Metadata = { title: "Masuk" };

const ERRORS: Record<string, string> = {
  tautan: "Tautan masuk tidak berlaku atau sudah kedaluwarsa. Minta tautan baru.",
  google: "Masuk dengan Google belum bisa dipakai. Pakai email dulu.",
};

export default async function MasukPage({ searchParams }: PageProps<"/masuk">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getUser()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <Page width="narrow">
      <TopBar back="/" />
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-title">Masuk ke Magerrr</h1>
          <p className="text-ui">Untuk host dan pengurus grup. Pemain cukup buka tautan undangan.</p>
        </div>
        <HighFive />
      </div>

      {error && <FlashToast text={error} tone="error" param="error" />}
      <EmailForm next={next} />

      <div className="flex items-center gap-3 text-small" aria-hidden="true">
        <span className="h-px flex-1 bg-sandstone" />
        atau
        <span className="h-px flex-1 bg-sandstone" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="secondary" size="lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.3-5.7" />
            <path d="M12 12h8" />
          </svg>
          Lanjut dengan Google
        </SubmitButton>
      </form>

      <Card className="border-dashed">
        <h2 className="text-ui font-medium">Diundang ke grup?</h2>
        <p className="mt-1 text-small">Buka tautan undangan dari WhatsApp untuk gabung tanpa akun.</p>
      </Card>
    </Page>
  );
}

/** Ilustrasi dua pemain tos (layar Masuk desain). Dekoratif. */
function HighFive() {
  return (
    <svg width="132" height="112" viewBox="0 0 132 112" fill="none" aria-hidden="true" className="hidden shrink-0 min-[400px]:block">
      <circle cx="66" cy="62" r="48" fill="var(--color-fresh-grass)" />
      <path d="M40 74l-6 34M48 74l6 34" stroke="var(--color-ink-black)" strokeWidth="8" strokeLinecap="round" />
      <path d="M44 48v28" stroke="var(--color-coral-pop)" strokeWidth="22" strokeLinecap="round" />
      <path d="M50 50l14-30" stroke="#E7A87B" strokeWidth="7" strokeLinecap="round" />
      <circle cx="44" cy="30" r="11" fill="#E7A87B" />
      <path d="M33 28c2-8 10-11 17-8 3 1 5 4 5 7-7-3-15-2-22 1z" fill="var(--color-ink-black)" />
      <path d="M86 74l-6 34M94 74l6 34" stroke="var(--color-ink-black)" strokeWidth="8" strokeLinecap="round" />
      <path d="M90 48v28" stroke="var(--color-ink-black)" strokeWidth="22" strokeLinecap="round" />
      <path d="M84 50L70 20" stroke="#8C5A3C" strokeWidth="7" strokeLinecap="round" />
      <circle cx="90" cy="30" r="11" fill="#8C5A3C" />
      <path d="M80 26c3-7 11-9 17-5 2 2 4 4 4 6-7-3-14-3-21-1z" fill="var(--color-ink-black)" />
      <path d="M58 8l-4-6M67 6V0M76 8l4-6" stroke="var(--color-coral-pop)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
