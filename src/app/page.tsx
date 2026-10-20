import Link from 'next/link';
import { FeaturedSession, sessionTones } from '@/components/featured-session';
import { Icon, type IconName } from '@/components/icons';
import { Logo } from '@/components/logo';
import { SessionStack } from '@/components/session-stack';
import { ButtonLink, Card, Page, textLinkClass } from '@/components/ui';
import { UserAvatar } from '@/components/user-avatar';
import { getAccount } from '@/lib/db/account';
import { getUser } from '@/lib/db/authz';
import { listMyGroups } from '@/lib/db/groups';
import { ensureSeriesSessions } from '@/lib/db/session-series';
import { listSessionsOfGroups } from '@/lib/db/sessions';
import { activeSessions } from '@/lib/session-order';
import { greeting, toJakartaParts } from '@/lib/time';

/** Kartu sesi di tumpukan beranda: sesi berlangsung / terdekat dari semua grup (MAGERRR-15). */
const SHOWN_SESSIONS = 5;

/**
 * Beranda (MAGERRR-13) mengikuti beranda grup: app bar sapaan + profil, tumpukan kartu sesi terdekat/berlangsung dari
 * semua grup pengunjung (MAGERRR-15; tautan "Lihat semua sesi"), lalu menu (daftar grup ada di menu Grup). Pengunjung tanpa akun & tanpa grup = halaman sambutan.
 */
export default async function Home() {
  const user = await getUser();
  const groups = await listMyGroups(user);
  if (!user && groups.length === 0) return <Welcome />;

  const now = new Date();
  // Sesi berulang (S5) disiapkan saat beranda dibuka, tanpa cron.
  await ensureSeriesSessions(groups.map((g) => g.id), toJakartaParts(now).date);
  const [account, sessions] = await Promise.all([
    user ? getAccount(user.id) : null,
    listSessionsOfGroups(groups.map((g) => g.id)),
  ]);
  const name = account?.displayName ?? groups[0]?.memberName ?? null;
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const shown = activeSessions(sessions, now).slice(0, SHOWN_SESSIONS);
  const tones = sessionTones(shown.map((s) => s.id));

  return (
    <Page width="wide">
      <header className="flex min-h-11 items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-small">
            {greeting(now)}
            {name ? ',' : ''}
          </p>
          <h1 className="truncate text-sub">{name ?? 'Magerrr'}</h1>
        </div>
        {user && account ? (
          <Link href="/profil" className="shrink-0 rounded-full">
            <UserAvatar
              name={account.displayName}
              url={account.avatarUrl}
              className="border border-ink-black"
            />
            <span className="sr-only">Profil kamu</span>
          </Link>
        ) : (
          <Link
            href="/masuk"
            className="flex min-h-11 items-center px-2 text-ui underline underline-offset-4"
          >
            Masuk
          </Link>
        )}
      </header>

      <div className="flex flex-col @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_22rem] @3xl:items-start @3xl:gap-x-8">
        <section
          aria-labelledby="sesi-terdekat"
          className="flex min-w-0 flex-col"
        >
          {shown.length > 0 ? (
            <SessionStack
              cards={shown.map((s, i) => (
                <FeaturedSession
                  key={s.id}
                  groupId={s.groupId}
                  session={s}
                  now={now}
                  groupName={groupName.get(s.groupId)}
                  headingId={`sesi-${s.id}`}
                  tone={tones[i]}
                />
              ))}
            />
          ) : (
            <Card className="flex flex-col gap-4">
              <p className="text-ui">
                {groups.length
                  ? 'Belum ada sesi yang berlangsung atau terjadwal.'
                  : 'Gabung atau buat grup untuk mulai mabar.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  href={user ? '/grup/baru' : '/masuk?next=/grup/baru'}
                >
                  Buat grup
                </ButtonLink>
                <ButtonLink href="/jelajah" variant="outline">
                  Gabung grup
                </ButtonLink>
              </div>
            </Card>
          )}

          {groups.length > 0 && (
            <div className="w-full flex justify-end">
              <Link href="/sesi" className={textLinkClass}>
                Lihat semua sesi
              </Link>
            </div>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <nav aria-labelledby="menu" className="flex flex-col gap-3">
            <h2 id="menu" className="text-sub">
              Menu
            </h2>
            <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-4 @3xl:grid-cols-2">
              <MenuTile href="/grup" icon="people" title="Grup" />
              <MenuTile href="/obrolan" icon="chat" title="Obrolan" />
              <MenuTile
                href={user ? '/profil' : '/masuk?next=/profil'}
                icon="user"
                title="Profil"
              />
              <MenuTile
                href="/sesi#riwayat"
                icon="calendar"
                title="Riwayat sesi"
              />
            </ul>
          </nav>
        </div>
      </div>
    </Page>
  );
}

function MenuTile({
  href,
  icon,
  title,
}: {
  href: string;
  icon: IconName;
  title: string;
}) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className="flex h-full min-h-24 flex-col items-start justify-between gap-3 rounded-2xl border border-ink-black bg-pure-white p-4 hover:bg-cream-paper"
      >
        <span
          className="flex size-11 items-center justify-center rounded-full bg-cream-paper"
          aria-hidden="true"
        >
          <Icon name={icon} />
        </span>
        <span className="text-ui">{title}</span>
      </Link>
    </li>
  );
}

/** Pengunjung baru (tanpa akun & tanpa grup). */
function Welcome() {
  return (
    <Page>
      <header className="flex min-h-11 items-center justify-between gap-3">
        <Logo />
        <Link
          href="/masuk"
          className="flex min-h-11 items-center px-2 text-ui underline underline-offset-4"
        >
          Masuk
        </Link>
      </header>
      <section className="mt-6 flex max-w-xl flex-col gap-4 sm:mt-12">
        <h1 className="text-title sm:text-display">
          Mabar badminton, beres di satu tempat.
        </h1>
        <p className="text-body">
          Atur sesi, catat skor, lihat klasemen, hitung patungan, lalu bagikan
          recap.
        </p>
      </section>
      <Link
        href="/jelajah"
        className="flex min-h-11 items-center self-start text-ui underline underline-offset-4"
      >
        Jelajahi grup publik
      </Link>
      <div className="flex flex-col gap-6 sm:max-w-xl">
        <ButtonLink
          href="/masuk"
          size="lg"
          className="sm:w-auto sm:self-start sm:px-8"
        >
          Masuk untuk buat grup
        </ButtonLink>
        <Card>
          <h2 className="text-sub">Diundang ke grup?</h2>
          <p className="mt-2 text-ui">
            Buka tautan undangan dari WhatsApp. Kamu bisa gabung tanpa akun.
          </p>
        </Card>
      </div>
    </Page>
  );
}
