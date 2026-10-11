import { ButtonLink, Card, Page, TopBar } from "@/components/ui";

/** Tampilan untuk pengunjung tanpa akses: belum dikenal (masuk / undangan) atau bukan anggota/admin. */
export function NoAccess({ reason, next }: { reason: "unknown" | "not-member" | "not-admin"; next: string }) {
  const copy = {
    unknown: ["Masuk dulu", "Halaman ini khusus anggota grup. Masuk dengan akun, atau buka tautan undangan dari admin grup."],
    "not-member": ["Belum jadi anggota", "Kamu belum bergabung di grup ini. Minta tautan undangan ke admin grup."],
    "not-admin": ["Khusus admin", "Hanya admin grup yang bisa membuka halaman ini."],
  }[reason];
  return (
    <Page width="narrow">
      <TopBar back="/" />
      <Card className="flex flex-col gap-3">
        <h1 className="text-sub">{copy[0]}</h1>
        <p className="text-ui">{copy[1]}</p>
        {reason === "unknown" && (
          <ButtonLink href={`/masuk?next=${encodeURIComponent(next)}`} size="lg">
            Masuk
          </ButtonLink>
        )}
      </Card>
    </Page>
  );
}
