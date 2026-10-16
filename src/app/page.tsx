import Link from "next/link";
import { GroupAvatar } from "@/components/group-avatar";
import { Badge, ButtonLink, Card, Page } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { listMyGroups } from "@/lib/db/groups";

export default async function Home() {
  const user = await getUser();
  const groups = await listMyGroups(user);

  return (
    <Page>
      <header className="flex min-h-11 items-center justify-between gap-3">
        <p className="text-lead">Magerrr</p>
        {user ? (
          <form action="/auth/keluar" method="post" className="flex items-center gap-1">
            <Link href="/profil" className="flex min-h-11 items-center px-2 text-ui underline underline-offset-4">
              Profil
            </Link>
            <button type="submit" className="min-h-11 cursor-pointer rounded-lg px-2 text-ui underline underline-offset-4 transition-colors hover:bg-fresh-grass/25">
              Keluar
            </button>
          </form>
        ) : (
          <Link href="/masuk" className="flex min-h-11 items-center px-2 text-ui underline underline-offset-4">
            Masuk
          </Link>
        )}
      </header>

      {groups.length === 0 ? (
        <section className="mt-6 flex max-w-xl flex-col gap-4 sm:mt-12">
          <h1 className="text-title sm:text-display">Mabar badminton, beres di satu tempat.</h1>
          <p className="text-body">Atur sesi, catat skor, lihat klasemen, hitung patungan, lalu bagikan recap.</p>
        </section>
      ) : (
        <h1 className="text-title">Grup kamu</h1>
      )}

      {groups.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id} className="min-w-0">
              <Link
                href={`/g/${group.id}`}
                className="flex h-full min-h-16 items-center gap-4 rounded-2xl border border-ink-black bg-pure-white p-4 hover:bg-cream-paper"
              >
                <GroupAvatar name={group.name} emoji={group.emoji} logoUrl={group.logoUrl} theme={group.theme} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-lead">{group.name}</span>
                  <span className="text-small">sebagai {group.memberName}</span>
                </span>
                {group.role === "admin" && <Badge tone="accent">Admin</Badge>}
                {group.role === "referee" && group.via === "account" && <Badge tone="sunshine">Wasit</Badge>}
                {group.via === "guest" && <Badge tone="outline">Tamu</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/jelajah" className="flex min-h-11 items-center self-start text-ui underline underline-offset-4">
        Jelajahi grup publik
      </Link>

      {user ? (
        <ButtonLink href="/grup/baru" variant={groups.length ? "secondary" : "primary"} size="lg" className="sm:w-auto sm:self-start sm:px-8">
          Buat grup
        </ButtonLink>
      ) : (
        groups.length === 0 && (
          <div className="flex flex-col gap-6 sm:max-w-xl">
            <ButtonLink href="/masuk" size="lg" className="sm:w-auto sm:self-start sm:px-8">
              Masuk untuk buat grup
            </ButtonLink>
            <Card>
              <h2 className="text-sub">Diundang ke grup?</h2>
              <p className="mt-2 text-ui">Buka tautan undangan dari WhatsApp. Kamu bisa gabung tanpa akun.</p>
            </Card>
          </div>
        )
      )}
    </Page>
  );
}
