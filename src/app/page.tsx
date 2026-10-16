import Link from "next/link";
import type { ReactNode } from "react";
import { FeaturedSession } from "@/components/featured-session";
import { GroupAvatar } from "@/components/group-avatar";
import { Icon, type IconName } from "@/components/icons";
import { Badge, ButtonLink, Card, Page, textLinkClass } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { getAccount } from "@/lib/db/account";
import { getUser } from "@/lib/db/authz";
import { listMyGroups, type GroupSummary } from "@/lib/db/groups";
import { listSessionsOfGroups } from "@/lib/db/sessions";
import { activeSessions } from "@/lib/session-order";
import { greeting } from "@/lib/time";
import { SessionLink } from "./g/[groupId]/session-link";

/** Kartu sesi di atas beranda: sesi berlangsung / terdekat dari semua grup (1 kartu besar + sisanya baris). */
const SHOWN_SESSIONS = 3;

/**
 * Beranda (MAGERRR-13) mengikuti beranda grup: app bar sapaan + profil, sesi terdekat/berlangsung dari semua grup
 * pengunjung (tautan "Lihat semua sesi"), lalu grup dan menu lain. Pengunjung tanpa akun & tanpa grup = halaman sambutan.
 */
export default async function Home() {
  const user = await getUser();
  const groups = await listMyGroups(user);
  if (!user && groups.length === 0) return <Welcome />;

  const now = new Date();
  const [account, sessions] = await Promise.all([user ? getAccount(user.id) : null, listSessionsOfGroups(groups.map((g) => g.id))]);
  const name = account?.displayName ?? groups[0]?.memberName ?? null;
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const [featured, ...others] = activeSessions(sessions, now).slice(0, SHOWN_SESSIONS);

  return (
    <Page width="wide">
      <header className="flex min-h-11 items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-small">
            {greeting(now)}
            {name ? "," : ""}
          </p>
          <h1 className="truncate text-sub">{name ?? "Magerrr"}</h1>
        </div>
        {user && account ? (
          <Link href="/profil" className="shrink-0 rounded-full">
            <UserAvatar name={account.displayName} url={account.avatarUrl} className="border border-ink-black" />
            <span className="sr-only">Profil kamu</span>
          </Link>
        ) : (
          <Link href="/masuk" className="flex min-h-11 items-center px-2 text-ui underline underline-offset-4">
            Masuk
          </Link>
        )}
      </header>

      <div className="flex flex-col gap-6 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_22rem] @3xl:items-start @3xl:gap-x-8">
        <section aria-labelledby="sesi-terdekat" className="flex min-w-0 flex-col gap-3">
          <h2 id="sesi-terdekat" className="text-sub">
            Sesi terdekat
          </h2>
          {featured ? (
            <>
              <FeaturedSession groupId={featured.groupId} session={featured} now={now} groupName={groupName.get(featured.groupId)} />
              {others.length > 0 && (
                <ul className="grid gap-3" data-testid="upcoming-sessions">
                  {others.map((s) => (
                    <li key={s.id} className="min-w-0">
                      <SessionLink groupId={s.groupId} session={s} groupName={groupName.get(s.groupId)} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Card>
              <p className="text-ui">{groups.length ? "Belum ada sesi yang berlangsung atau terjadwal." : "Gabung atau buat grup untuk mulai mabar."}</p>
            </Card>
          )}
          {groups.length > 0 && (
            <Link href="/sesi" className={textLinkClass}>
              Lihat semua sesi
            </Link>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {groups.length > 0 && <MyGroups groups={groups} />}

          <nav aria-label="Menu" className="flex flex-col gap-3">
            <h2 className="text-sub">Menu</h2>
            {user ? (
              <MenuLink href="/grup/baru" icon="people" title="Buat grup" detail="Ajak teman mabar rutin" />
            ) : (
              <MenuLink href="/masuk?next=/grup/baru" icon="user" title="Masuk untuk buat grup" detail="Simpan riwayatmu ke akun" />
            )}
            <MenuLink href="/jelajah" icon="search" title="Jelajahi grup publik" detail="Cari grup terbuka untuk gabung" />
            {user && <MenuLink href="/profil" icon="user" title="Profil" detail="Nama, foto, dan email akun" />}
            {user && (
              <form action="/auth/keluar" method="post">
                <SubmitRow icon="back" title="Keluar" detail="Akhiri sesi masuk di perangkat ini" />
              </form>
            )}
          </nav>
        </div>
      </div>
    </Page>
  );
}

function MyGroups({ groups }: { groups: GroupSummary[] }) {
  return (
    <section aria-labelledby="grup-kamu" className="flex flex-col gap-3">
      <h2 id="grup-kamu" className="text-sub">
        Grup kamu
      </h2>
      <ul className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-1">
        {groups.map((group) => (
          <li key={group.id} className="min-w-0">
            <Link
              href={`/g/${group.id}`}
              className="flex h-full min-h-16 items-center gap-4 rounded-2xl border border-ink-black bg-pure-white p-4 hover:bg-cream-paper"
            >
              <GroupAvatar name={group.name} emoji={group.emoji} logoUrl={group.logoUrl} theme={group.theme} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-lead">{group.name}</span>
                <span className="truncate text-small">sebagai {group.memberName}</span>
              </span>
              {group.role === "admin" && <Badge tone="accent">Admin</Badge>}
              {group.role === "referee" && group.via === "account" && <Badge tone="sunshine">Wasit</Badge>}
              {group.via === "guest" && <Badge tone="outline">Tamu</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const rowClass = "flex min-h-16 w-full items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-4 py-3 text-left hover:bg-cream-paper";

function RowContent({ icon, title, detail }: { icon: IconName; title: string; detail: string }): ReactNode {
  return (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream-paper" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ui">{title}</span>
        <span className="text-small">{detail}</span>
      </span>
    </>
  );
}

function MenuLink({ href, icon, title, detail }: { href: string; icon: IconName; title: string; detail: string }) {
  return (
    <Link href={href} className={rowClass}>
      <RowContent icon={icon} title={title} detail={detail} />
      <Icon name="chevron" size={18} />
    </Link>
  );
}

function SubmitRow({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  return (
    <button type="submit" className={`${rowClass} cursor-pointer`}>
      <RowContent icon={icon} title={title} detail={detail} />
    </button>
  );
}

/** Pengunjung baru (tanpa akun & tanpa grup). */
function Welcome() {
  return (
    <Page>
      <header className="flex min-h-11 items-center justify-between gap-3">
        <p className="text-lead">Magerrr</p>
        <Link href="/masuk" className="flex min-h-11 items-center px-2 text-ui underline underline-offset-4">
          Masuk
        </Link>
      </header>
      <section className="mt-6 flex max-w-xl flex-col gap-4 sm:mt-12">
        <h1 className="text-title sm:text-display">Mabar badminton, beres di satu tempat.</h1>
        <p className="text-body">Atur sesi, catat skor, lihat klasemen, hitung patungan, lalu bagikan recap.</p>
      </section>
      <Link href="/jelajah" className="flex min-h-11 items-center self-start text-ui underline underline-offset-4">
        Jelajahi grup publik
      </Link>
      <div className="flex flex-col gap-6 sm:max-w-xl">
        <ButtonLink href="/masuk" size="lg" className="sm:w-auto sm:self-start sm:px-8">
          Masuk untuk buat grup
        </ButtonLink>
        <Card>
          <h2 className="text-sub">Diundang ke grup?</h2>
          <p className="mt-2 text-ui">Buka tautan undangan dari WhatsApp. Kamu bisa gabung tanpa akun.</p>
        </Card>
      </div>
    </Page>
  );
}
