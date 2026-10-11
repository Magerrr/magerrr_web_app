import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Badge, ButtonLink, Card, Page, TopBar, buttonClass, inputBase } from "@/components/ui";
import { guestCookieName } from "@/lib/db/authz";
import { unreadCount } from "@/lib/db/chat";
import { counterpartBalances } from "@/lib/core/balance";
import { getGroup } from "@/lib/db/groups";
import { listMembers } from "@/lib/db/members";
import { unpaidGroupSettlements } from "@/lib/db/profile";
import { listSessions, type SessionSummary } from "@/lib/db/sessions";
import { formatRupiah, formatShortDateId, formatTimeRangeId } from "@/lib/format";
import { pageAccess } from "./access";
import { STATUS_LABEL, STATUS_TONE } from "./sesi/status";

export const metadata: Metadata = { title: "Grup" };

export default async function GroupPage({ params, searchParams }: PageProps<"/g/[groupId]">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}`} />;

  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.trim() : "";
  const { member, via } = access.membership;
  const [group, members, sessions, unread, unpaid] = await Promise.all([
    getGroup(groupId),
    listMembers(groupId),
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

  return (
    <Page width="wide">
      <TopBar back="/" />
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-ink-black bg-pure-white text-title" aria-hidden="true">
          {group.emoji ?? group.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title break-words">{group.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-small">
            sebagai {member.display_name}
            {isAdmin && <Badge tone="accent">Admin</Badge>}
            {via === "guest" && <Badge tone="outline">Tamu</Badge>}
          </p>
        </div>
      </div>

      {/* Lebar: sesi di kolom kiri, aksi di kolom kanan. Ponsel: urutan DOM (aksi, sesi, menu). */}
      <div
        className={
          hasActions
            ? "flex flex-col gap-6 @panel:grid @panel:grid-cols-[minmax(0,1fr)_22rem] @panel:grid-rows-[auto_1fr] @panel:items-start @panel:gap-x-8"
            : "flex flex-col gap-6"
        }
      >
        {hasActions && (
          <div className="flex flex-col gap-6 @panel:col-start-2 @panel:row-start-1">
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
              <ButtonLink href={`/g/${groupId}/sesi/baru`} size="lg">
                Buat sesi
              </ButtonLink>
            )}
          </div>
        )}

        <section aria-labelledby="riwayat" className="flex min-w-0 flex-col gap-3 @panel:col-start-1 @panel:row-span-2 @panel:row-start-1">
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
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="session-list">
              {sessions.map((s) => (
                <li key={s.id} className="min-w-0">
                  <SessionLink groupId={groupId} session={s} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Desktop memakai sidebar (layout.tsx); menu ini untuk ponsel & tablet. */}
        <nav aria-label="Menu grup" className="grid gap-3 sm:grid-cols-2 lg:hidden">
          <MenuLink
            href={`/g/${groupId}/obrolan`}
            title="Obrolan"
            detail={unread > 0 ? `${unread > 99 ? "99+" : unread} pesan baru` : "Ngobrol dengan anggota grup"}
            badge={unread > 0 ? (unread > 99 ? "99+" : String(unread)) : undefined}
          />
          <MenuLink href={`/g/${groupId}/kiko`} title="Kiko kamu" detail="Maskot yang tumbuh tiap kamu main" />
          <MenuLink href={`/g/${groupId}/leaderboard`} title="Leaderboard" detail="Klasemen ganda & pasangan terbaik" />
          <MenuLink href={`/g/${groupId}/musim`} title="Musim" detail="Klasemen per musim & juara" />
          <MenuLink href={`/g/${groupId}/anggota`} title="Anggota" detail={`${members.length} orang`} />
          <MenuLink href={`/g/${groupId}/saldo`} title="Saldo patungan" detail={balanceDetail} />
          {isAdmin && <MenuLink href={`/g/${groupId}/pengaturan`} title="Pengaturan grup" detail="Aturan skor, poin klasemen, patungan" />}
        </nav>
      </div>
    </Page>
  );
}

function SessionLink({ groupId, session: s }: { groupId: string; session: SessionSummary }) {
  return (
    <Link
      href={`/g/${groupId}/sesi/${s.id}`}
      className="flex h-full min-h-16 items-center gap-4 rounded-2xl border border-ink-black bg-pure-white px-4 py-3 hover:bg-cream-paper"
      data-testid="session-item"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-lead">{formatShortDateId(s.startsAt)}</span>
        <span className="truncate text-small">
          {formatTimeRangeId(s.startsAt, s.durationMin)}
          {s.venue ? ` · ${s.venue}` : ""}
        </span>
        <span className="text-small">
          {s.presentCount} hadir · {s.courtCount} lapangan
        </span>
      </span>
      <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
    </Link>
  );
}

function MenuLink({ href, title, detail, badge }: { href: string; title: string; detail: string; badge?: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-5 py-3 hover:bg-cream-paper">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-lead">{title}</span>
        <span className="text-small">{detail}</span>
      </span>
      {badge && (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-ink-black bg-fresh-grass px-2 text-caption" aria-hidden="true">
          {badge}
        </span>
      )}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
