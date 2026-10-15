import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { NoAccess } from "@/components/no-access";
import { Badge, ButtonLink, Card, Page, buttonClass, inputBase } from "@/components/ui";
import { guestCookieName } from "@/lib/db/authz";
import { unreadCount } from "@/lib/db/chat";
import { counterpartBalances } from "@/lib/core/balance";
import { getGroup } from "@/lib/db/groups";
import { loadKiko } from "@/lib/db/kiko";
import { loadGroupMatches } from "@/lib/db/matches";
import { unpaidGroupSettlements } from "@/lib/db/profile";
import { listSessions, type SessionSummary } from "@/lib/db/sessions";
import { formatRupiah, formatShortDateId, formatTimeRangeId, initials } from "@/lib/format";
import { toJakartaParts } from "@/lib/time";
import { pageAccess } from "./access";
import { KikoCard } from "./kiko-card";
import { SessionLink } from "./session-link";

export const metadata: Metadata = { title: "Grup" };

export default async function GroupPage({ params, searchParams }: PageProps<"/g/[groupId]">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}`} />;

  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.trim() : "";
  const { member, via } = access.membership;
  const [group, sessions, unread, unpaid] = await Promise.all([
    getGroup(groupId),
    listSessions(groupId, query),
    unreadCount(groupId, member.id),
    unpaidGroupSettlements(groupId),
  ]);
  const myNet = counterpartBalances(unpaid, member.id).reduce((sum, c) => sum + c.net, 0);
  const balanceDetail =
    myNet < 0 ? `Kamu kurang bayar ${formatRupiah(-myNet)}` : myNet > 0 ? `Kamu akan terima ${formatRupiah(myNet)}` : "Utang & piutang lintas sesi";
  const isAdmin = member.role === "admin" && via === "account";
  const guestToken = via === "guest" ? (await cookies()).get(guestCookieName(groupId))?.value : undefined;
  const hasActions = isAdmin || Boolean(guestToken);
  const now = new Date();
  const featured = featuredSession(sessions, now);
  const kiko = await loadKiko(groupId, member.id, await loadGroupMatches(groupId), now);

  return (
    <Page width="wide">
      <header className="flex items-center gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-full border border-ink-black bg-fresh-grass text-ui"
          aria-hidden="true"
        >
          {initials(member.display_name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-small">
            {greeting(now)}, {member.display_name}
          </p>
          <h1 className="text-sub break-words">{group.name}</h1>
        </div>
        {isAdmin && <Badge tone="accent">Admin</Badge>}
        {via === "guest" && <Badge tone="outline">Tamu</Badge>}
        <Link
          href="/"
          aria-label="Semua grup"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink-black bg-pure-white hover:bg-sandstone"
        >
          <Icon name="grid" />
        </Link>
      </header>

      {/*
        Lebar (@3xl = 48rem): kolom kiri = sesi berikutnya + daftar sesi, kolom kanan 22rem = Kiko, aksi, menu.
        Ponsel: satu kolom urut kepentingan: sesi berikutnya, aksi (Buat sesi), daftar sesi, lalu menu lain
        (`contents` + `order`). Ponsel tidak punya bar bawah, jadi semua menu grup ada di sini.
      */}
      <div className="flex flex-col gap-6 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_22rem] @3xl:items-start @3xl:gap-x-8">
        <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-6">
          {featured && (
            <div className="order-1">
              <FeaturedSession groupId={groupId} session={featured} now={now} />
            </div>
          )}
        <section aria-labelledby="riwayat" className="order-3 flex min-w-0 flex-col gap-3">
          <h2 id="riwayat" className="text-sub">
            Sesi
          </h2>
          {(sessions.length > 0 || query) && (
            <form role="search" className="flex gap-2">
              <input
                name="q"
                type="search"
                defaultValue={query}
                aria-label="Cari sesi berdasarkan tempat atau catatan"
                maxLength={50}
                className={`${inputBase} min-w-0 flex-1`}
              />
              <button type="submit" className={buttonClass("secondary", "md", "min-h-13")}>
                Cari
              </button>
            </form>
          )}
          {sessions.length === 0 ? (
            <Card>
              {query ? (
                <p className="text-ui">Tidak ada sesi yang cocok dengan “{query}”.</p>
              ) : (
                <>
                  <h3 className="text-lead">Belum ada sesi</h3>
                  <p className="mt-2 text-ui">{isAdmin ? "Buat sesi pertama untuk mulai mencatat mabar." : "Sesi mabar grup ini akan muncul di sini."}</p>
                </>
              )}
            </Card>
          ) : (
            <ul className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-1 @5xl:grid-cols-2" data-testid="session-list">
              {sessions.map((s) => (
                <li key={s.id} className="min-w-0">
                  <SessionLink groupId={groupId} session={s} />
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>

        <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-6">
          <KikoCard groupId={groupId} kiko={kiko} className="order-0 hidden @3xl:flex" />
        {hasActions && (
          <div className="order-2 flex flex-col gap-6">
            {via === "guest" && guestToken && (
              <Card className="flex flex-col gap-3" data-testid="claim-card">
                <h2 className="text-lead">Simpan riwayatmu ke akun</h2>
                <p className="text-small">Kamu bergabung sebagai tamu di peramban ini. Masuk dengan akun agar statistik dan tagihanmu bisa dibuka dari perangkat lain.</p>
                <ButtonLink href={`/klaim/${guestToken}`} variant="secondary">
                  Klaim profil
                </ButtonLink>
              </Card>
            )}

            {isAdmin && (
              <ButtonLink href={`/g/${groupId}/sesi/baru`} size="lg" className="sm:max-lg:hidden">
                Buat sesi
              </ButtonLink>
            )}
          </div>
        )}

        {/* Desktop memakai sidebar (layout.tsx); menu ini untuk ponsel & tablet. Anggota & Profil hanya di ponsel (tablet punya rail). */}
        <nav aria-label="Menu grup" className="order-4 flex flex-col gap-4 lg:hidden">
          <ul className="grid grid-cols-4 gap-2">
            <Tile href={`/g/${groupId}/leaderboard`} icon="chart" label="Leaderboard" dark />
            <Tile href={`/g/${groupId}/anggota`} icon="people" label="Anggota" className="sm:hidden" />
            <Tile href={`/g/${groupId}/musim`} icon="trophy" label="Musim" />
            <Tile href={`/g/${groupId}/recap`} icon="recap" label="Recap" full="Recap bulan & musim" />
            <Tile href={`/g/${groupId}/kiko`} icon="cat" label="Kiko" full="Kiko kamu" />
            <Tile href={`/g/${groupId}/pembayaran`} icon="card" label="Pembayaran" full="Info pembayaran" />
            <Tile href={`/g/${groupId}/anggota/${member.id}`} icon="user" label="Profil" full="Profil kamu" className="sm:hidden" />
            {isAdmin && <Tile href={`/g/${groupId}/pengaturan`} icon="gear" label="Pengaturan" full="Pengaturan grup" />}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <MenuLink
              href={`/g/${groupId}/obrolan`}
              icon="chat"
              title="Obrolan"
              detail={unread > 0 ? `${unread > 99 ? "99+" : unread} pesan baru` : "Ngobrol dengan anggota grup"}
              badge={unread > 0 ? (unread > 99 ? "99+" : String(unread)) : undefined}
            />
            <MenuLink href={`/g/${groupId}/saldo`} icon="wallet" title="Saldo patungan" detail={balanceDetail} />
          </div>
        </nav>
        </div>
      </div>
    </Page>
  );
}

function greeting(now: Date): string {
  const hour = Number(toJakartaParts(now).time.slice(0, 2));
  return hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
}

/** Sesi yang sedang berlangsung, kalau tidak ada: sesi rencana terdekat yang belum lewat. */
function featuredSession(sessions: SessionSummary[], now: Date): SessionSummary | undefined {
  const running = sessions.find((s) => s.status === "running");
  if (running) return running;
  const upcoming = sessions.filter((s) => s.status === "planned" && s.startsAt.getTime() >= now.getTime() - 3 * 3_600_000);
  return upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
}

const DAY_MS = 86_400_000;
function untilLabel(session: SessionSummary, now: Date): string {
  if (session.status === "running") return "Berlangsung";
  const day = (d: Date) => Date.parse(toJakartaParts(d).date);
  const days = Math.round((day(session.startsAt) - day(now)) / DAY_MS);
  return days <= 0 ? "Hari ini" : days === 1 ? "Besok" : `${days} hari lagi`;
}

/** Kartu sesi berikutnya (layar Beranda desain): isi ink-black, teks cream-paper, tombol aksen fresh-grass. */
function FeaturedSession({ groupId, session: s, now }: { groupId: string; session: SessionSummary; now: Date }) {
  return (
    <section aria-labelledby="sesi-berikutnya" className="flex flex-col gap-4 rounded-2xl bg-ink-black p-5 text-cream-paper" data-testid="featured-session">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption text-ink-black ${s.status === "running" ? "bg-fresh-grass" : "bg-sunshine-pop"}`}
        >
          {s.status === "running" && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ink-black motion-safe:animate-pulse" />}
          {untilLabel(s, now)}
        </span>
        <h2 id="sesi-berikutnya" className="text-small">
          {s.status === "running" ? "Sesi sekarang" : "Sesi berikutnya"}
        </h2>
      </div>
      <p className="text-title">{formatShortDateId(s.startsAt)}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small">
        <li className="flex items-center gap-2">
          <Icon name="calendar" size={16} className="text-fresh-grass" />
          {formatTimeRangeId(s.startsAt, s.durationMin)}
        </li>
        {s.venue && (
          <li className="flex min-w-0 items-center gap-2">
            <Icon name="pin" size={16} className="shrink-0 text-fresh-grass" />
            <span className="truncate">{s.venue}</span>
          </li>
        )}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <p className="text-small">
          {s.presentCount} hadir · {s.courtCount} lapangan
        </p>
        <Link
          href={`/g/${groupId}/sesi/${s.id}`}
          className="inline-flex min-h-11 items-center rounded-full bg-fresh-grass px-5 text-ui text-ink-black"
        >
          Detail
        </Link>
      </div>
    </section>
  );
}

function Tile({ href, icon, label, full, dark, className }: { href: string; icon: IconName; label: string; full?: string; dark?: boolean; className?: string }) {
  return (
    <li className={className}>
      <Link href={href} aria-label={full} className="flex min-h-11 flex-col items-center gap-1.5 text-caption">
        <span
          className={
            "flex size-14 items-center justify-center rounded-2xl border border-ink-black " +
            (dark ? "bg-ink-black text-fresh-grass" : "bg-pure-white text-ink-black")
          }
        >
          <Icon name={icon} size={24} />
        </span>
        {label}
      </Link>
    </li>
  );
}

function MenuLink({ href, icon, title, detail, badge }: { href: string; icon: IconName; title: string; detail: string; badge?: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-4 py-3 hover:bg-cream-paper">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream-paper" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ui">{title}</span>
        <span className="text-small">{detail}</span>
      </span>
      {badge && (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-ink-black bg-fresh-grass px-2 text-caption" aria-hidden="true">
          {badge}
        </span>
      )}
      <Icon name="chevron" size={18} />
    </Link>
  );
}
