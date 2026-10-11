import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Card, Notice, Page, TopBar } from "@/components/ui";
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
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Masuk ke Magerrr</h1>
        <p className="text-ui">Untuk host dan pengurus grup. Pemain cukup buka tautan undangan.</p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      <EmailForm next={next} />

      <div className="flex items-center gap-3 text-small" aria-hidden="true">
        <span className="h-px flex-1 bg-sandstone" />
        atau
        <span className="h-px flex-1 bg-sandstone" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" size="lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.3-5.7" />
            <path d="M12 12h8" />
          </svg>
          Lanjut dengan Google
        </Button>
      </form>

      <Card className="border-dashed">
        <h2 className="text-ui font-medium">Diundang ke grup?</h2>
        <p className="mt-1 text-small">Buka tautan undangan dari WhatsApp untuk gabung tanpa akun.</p>
      </Card>
    </Page>
  );
}
