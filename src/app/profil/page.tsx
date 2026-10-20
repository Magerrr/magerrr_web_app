import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupAvatar } from "@/components/group-avatar";
import { FlashToast } from "@/components/toast";
import { Card, Page, TopBar } from "@/components/ui";
import { getAccount } from "@/lib/db/account";
import { getUser } from "@/lib/db/authz";
import { listMyGroups } from "@/lib/db/groups";
import { createAuthClient } from "@/lib/db/supabase";
import { AvatarField, EmailForm, NameForm } from "./profile-forms";

export const metadata: Metadata = { title: "Profil" };

/**
 * Pesan setelah membuka tautan konfirmasi ganti email. Dengan konfirmasi ganda + PKCE, tautan kedua bisa kembali
 * tanpa kode (atau dengan error) meski email sudah berganti, jadi status dibaca dari akun: masih ada email tertunda
 * = menunggu tautan lain.
 */
function emailNotice(param: string | string[] | undefined, pendingEmail: string | null): string | null {
  if (param !== "terkonfirmasi" && param !== "lanjut") return null;
  return pendingEmail
    ? "Tautan konfirmasi diterima. Buka juga tautan konfirmasi di email satunya agar email akunmu berganti."
    : "Email akunmu sudah diganti.";
}

/** Profil akun (MAGERRR-12): foto, nama, email. Tamu tanpa akun diarahkan masuk dulu. */
export default async function ProfilPage({ searchParams }: PageProps<"/profil">) {
  const user = await getUser();
  if (!user) redirect("/masuk?next=/profil");
  const params = await searchParams;

  const [account, auth, groups] = await Promise.all([getAccount(user.id), (await createAuthClient()).auth.getUser(), listMyGroups(user)]);
  const authUser = auth.data.user;
  const email = authUser?.email ?? user.email;
  const pendingEmail = authUser?.new_email ?? null;
  const accountGroups = groups.filter((g) => g.via === "account");
  const notice = emailNotice(params.email, pendingEmail);

  return (
    <Page width="narrow">
      <TopBar back="/" title="Profil" />

      {notice && <FlashToast text={notice} param="email" />}

      <AvatarField name={account.displayName} url={account.avatarUrl} />
      <NameForm name={account.displayName} />
      <EmailForm email={email} pendingEmail={pendingEmail} />

      {accountGroups.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-sub">Nama di grup</h2>
          <ul className="flex flex-col gap-2" data-testid="group-names">
            {accountGroups.map((g) => (
              <li key={g.id}>
                <Link href={`/g/${g.id}`} className="flex min-h-11 items-center gap-3 rounded-lg px-1 hover:bg-cream-paper">
                  <GroupAvatar name={g.name} emoji={g.emoji} logoUrl={g.logoUrl} theme={g.theme} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-ui">{g.name}</span>
                  <span className="truncate text-small">{g.memberName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form action="/auth/keluar" method="post" className="flex justify-center">
        {/* Garis tepi coral-pop, teks ink-black; coral-pop tidak dipakai sebagai warna teks. Hover = isi coral muda. */}
        <button
          type="submit"
          className="w-full min-h-11 cursor-pointer rounded-full border-1 border-coral-pop bg-transparent px-8 text-ui font-medium text-ink-black transition-[background-color] hover:bg-coral-pop/20"
        >
          Keluar
        </button>
      </form>
    </Page>
  );
}
