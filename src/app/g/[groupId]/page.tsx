import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeaturedSession } from "@/components/featured-session";
import { GroupAvatar } from "@/components/group-avatar";
import { Icon, type IconName } from "@/components/icons";
import { NoAccess } from "@/components/no-access";
import { Badge, ButtonLink, Card, Page, TopBar, buttonClass, inputBase } from "@/components/ui";
import { guestCookieName } from "@/lib/db/authz";
import { unreadCount } from "@/lib/db/chat";
import { counterpartBalances } from "@/lib/core/balance";
import { findPublicGroup, getGroup } from "@/lib/db/groups";
import { loadKiko } from "@/lib/db/kiko";
import { loadGroupMatches } from "@/lib/db/matches";
import { listMoments } from "@/lib/db/moments";
import { unpaidGroupSettlements } from "@/lib/db/profile";
import { ensureSeriesSessions } from "@/lib/db/session-series";
import { toJakartaParts } from "@/lib/time";
import { listSessions } from "@/lib/db/sessions";
import { formatRupiah } from "@/lib/format";
import { THEME_BG } from "@/lib/group-theme";
import { activeSessions } from "@/lib/session-order";
import { pageAccess } from "./access";
import { KikoCard } from "./kiko-card";
import { SessionLink } from "./session-link";

export const metadata: Metadata = { title: "Grup" };

export default async function GroupPage({ params, searchParams }: PageProps<"/g/[groupId]">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) {
    // Grup publik: pengunjung yang belum anggota diarahkan ke pratinjau + gabung terbuka (MAGERRR-6).
    if (await findPublicGroup(groupId)) redirect(`/jelajah/${groupId}`);
    return <NoAccess reason={access.denied} next={`/g/${groupId}`} />;
  }

  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.trim() : "";
  const { member, via } = access.membership;
  // Sesi berulang (S5) disiapkan saat grup dibuka, tanpa cron.
  await ensureSeriesSessions([groupId], toJakartaParts(new Date()).date);
  const [group, sessions, unread, unpaid, moments] = await Promise.all([
    getGroup(groupId),
    listSessions(groupId, query),
    unreadCount(groupId, member.id),
    unpaidGroupSettlements(groupId),
    listMoments(groupId, 6),
  ]);
  const myNet = counterpartBalances(unpaid, member.id).reduce((sum, c) => sum + c.net, 0);
  const balanceDetail =
    myNet < 0 ? `Kamu kurang bayar ${formatRupiah(-myNet)}` : myNet > 0 ? `Kamu akan terima ${formatRupiah(myNet)}` : "Utang & piutang lintas sesi";
  const isAdmin = member.role === "admin" && via === "account";
  const guestToken = via === "guest" ? (await cookies()).get(guestCookieName(groupId))?.value : undefined;
  const hasActions = isAdmin || Boolean(guestToken);
  const now = new Date();
  const featured = activeSessions(sessions, now)[0];
  const kiko = await loadKiko(groupId, member.id, await loadGroupMatches(groupId), now);

  return (
    <Page width="wide">
      {/* Kembali ke beranda pengguna lewat panah di atas (MAGERRR-19), bukan tombol ikon grup. */}
      <TopBar back="/" backLabel="Kembali ke beranda" title="Grup" />
      {/*
        Sampul & logo grup (MAGERRR-8): sampul berasio 3:1 dan logo menumpang di tepi bawahnya; tanpa sampul = tidak ada latar sampul, logo & nama saja.
        Kepala hanya identitas grup (MAGERRR-20): tanpa sapaan & nama pengguna.
      */}
      <div className={`flex flex-col ${group.coverUrl ? "-mt-2" : ""}`}>
        {group.coverUrl && (
          <div
            className={`relative aspect-[3/1] max-h-56 w-full overflow-hidden rounded-2xl border border-ink-black ${THEME_BG[group.theme]}`}
            data-testid="group-cover"
          >
            <Image src={group.coverUrl} alt="" fill unoptimized priority sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" />
          </div>
        )}
        <header className={`flex items-start gap-3 ${group.coverUrl ? "px-3" : ""}`}>
          <GroupAvatar
            name={group.name}
            emoji={group.emoji}
            logoUrl={group.logoUrl}
            theme={group.theme}
            size="lg"
            className={`relative border-1 sm:size-20 ${group.coverUrl ? "-mt-8 ring-4 ring-cream-paper sm:-mt-10" : ""}`}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
            <h1 className="text-sub break-words">{group.name}</h1>
            {(isAdmin || (member.role === "referee" && via === "account") || via === "guest") && (
              <div className="flex flex-wrap gap-2">
                {isAdmin && <Badge tone="accent">Admin</Badge>}
                {member.role === "referee" && via === "account" && <Badge tone="sunshine">Wasit</Badge>}
                {via === "guest" && <Badge tone="outline">Tamu</Badge>}
              </div>
            )}
          </div>
        </header>
      </div>

      {/*
        Lebar (@3xl = 48rem): kolom kiri = sesi berlangsung/terdekat, momen, daftar sesi (paling bawah); kolom kanan 22rem =
        Kiko, aksi, menu. Ponsel satu kolom (MAGERRR-20): sesi berlangsung/terdekat, aksi (Buat sesi), semua menu, momen,
        lalu daftar sesi paling bawah (`contents` + `order`). Ponsel tidak punya bar bawah, jadi semua menu grup ada di sini.
      */}
      <div className="flex flex-col gap-6 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_22rem] @3xl:items-start @3xl:gap-x-8">
        <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-6">
          {featured && (
            <div className="order-1">
              <FeaturedSession groupId={groupId} session={featured} now={now} />
            </div>
          )}
        {moments.length > 0 && (
          <section aria-labelledby="momen-terbaru" className="order-4 flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="momen-terbaru" className="text-sub">
                Momen
              </h2>
              <Link href={`/g/${groupId}/momen`} className="flex min-h-11 items-center px-1 text-small underline underline-offset-4">
                Lihat semua
              </Link>
            </div>
            <ul className="grid grid-cols-3 gap-2 @xl:grid-cols-6 @3xl:grid-cols-3 @5xl:grid-cols-6" data-testid="recent-moments">
              {moments.map((m) => (
                <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl border border-ink-black bg-sandstone">
                  <Image src={m.url} alt={m.caption ?? `Foto dari ${m.memberName}`} fill unoptimized sizes="160px" className="object-cover" />
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="riwayat" className="order-5 flex min-w-0 flex-col gap-3">
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
        <nav aria-label="Menu grup" className="order-3 flex flex-col gap-4 lg:hidden">
          <ul className="grid grid-cols-4 gap-2">
            <Tile href={`/g/${groupId}/leaderboard`} icon="chart" label="Leaderboard" dark />
            <Tile href={`/g/${groupId}/anggota`} icon="people" label="Anggota" className="sm:hidden" />
            <Tile href={`/g/${groupId}/musim`} icon="trophy" label="Musim" />
            <Tile href={`/g/${groupId}/recap`} icon="recap" label="Recap" full="Recap bulan & musim" />
            <Tile href={`/g/${groupId}/kiko`} icon="cat" label="Kiko" full="Kiko kamu" />
            <Tile href={`/g/${groupId}/momen`} icon="camera" label="Momen" full="Momen grup" />
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
