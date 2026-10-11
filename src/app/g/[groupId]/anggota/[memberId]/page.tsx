import type { Metadata } from "next";
import Link from "next/link";
import { CopyLink } from "@/components/copy-link";
import { Kiko } from "@/components/kiko";
import { LinkSelect } from "@/components/link-select";
import { NoAccess } from "@/components/no-access";
import { Badge, Card, Page, Split, TopBar, textLinkClass } from "@/components/ui";
import { currentStreak, frequentOpponents, headToHead, longestWinStreak, playerMatches, recentForm, sideOf, type Outcome } from "@/lib/core/player";
import { bestPartner, pairStats, standings } from "@/lib/core/standings";
import { getGroup } from "@/lib/db/groups";
import { loadKiko } from "@/lib/db/kiko";
import { loadGroupMatches } from "@/lib/db/matches";
import { claimTokenOf, memberNames } from "@/lib/db/members";
import { publicEnv } from "@/lib/env";
import { getMemberProfile, memberSettlements } from "@/lib/db/profile";
import { formatPercent, formatRupiah, formatShortDateId, formatSigned, initials } from "@/lib/format";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../access";

export const metadata: Metadata = { title: "Profil pemain" };

const OUTCOME_LABEL: Record<Outcome, string> = { W: "M", L: "K" };

function FormChips({ form }: { form: Outcome[] }) {
  return (
    <ol className="flex gap-2" aria-label={`Form: ${form.map((f) => (f === "W" ? "menang" : "kalah")).join(", ")}`} data-testid="form">
      {form.map((f, i) => (
        <li
          key={i}
          aria-hidden="true"
          className={`flex size-9 items-center justify-center rounded-full border border-ink-black text-small ${f === "W" ? "bg-fresh-grass" : "bg-pure-white"}`}
        >
          {OUTCOME_LABEL[f]}
        </li>
      ))}
    </ol>
  );
}

/** Profil & statistik pemain (PRD X2, L6–L7): semua diturunkan dari match ganda grup. */
export default async function MemberProfilePage({ params, searchParams }: PageProps<"/g/[groupId]/anggota/[memberId]">) {
  const { groupId, memberId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/anggota/${memberId}`} />;
  const me = access.membership.member.id;

  const isAdmin = access.membership.member.role === "admin" && access.membership.via === "account";
  const [group, profile, matches, names, settlements] = await Promise.all([
    getGroup(groupId),
    isUuid(memberId) ? getMemberProfile(groupId, memberId) : null,
    loadGroupMatches(groupId),
    memberNames(groupId),
    memberSettlements(groupId, memberId),
  ]);
  if (!profile) {
    return (
      <Page>
        <TopBar back={`/g/${groupId}/anggota`} title={group.name} />
        <Card>
          <h1 className="text-sub">Anggota tidak ditemukan</h1>
        </Card>
      </Page>
    );
  }

  const kiko = await loadKiko(groupId, memberId, matches, new Date());
  const name = (id: string) => names[id] ?? "?";
  const team = (ids: string[]) => ids.map(name).join(" / ");
  const table = standings(
    matches.filter((m) => m.kind === "doubles"),
    group.scoring,
    { kind: "all" },
  );
  const row = table.find((r) => r.memberId === memberId) ?? null;
  const mine = playerMatches(matches, memberId);
  const form = recentForm(matches, memberId);
  const streak = currentStreak(matches, memberId);
  const partner = bestPartner(pairStats(matches), memberId);
  const opponents = frequentOpponents(matches, memberId);
  const lawan = (await searchParams).lawan;
  const rival = typeof lawan === "string" && opponents.some((o) => o.memberId === lawan) ? lawan : (opponents[0]?.memberId ?? null);
  const h2h = rival ? headToHead(matches, memberId, rival) : null;
  const unpaid = settlements.filter((s) => s.status !== "paid");
  const owes = unpaid.filter((s) => s.from === memberId).reduce((sum, s) => sum + s.amount, 0);
  const owed = unpaid.filter((s) => s.to === memberId).reduce((sum, s) => sum + s.amount, 0);
  const base = `/g/${groupId}/anggota/${memberId}`;

  return (
    <Page width="wide">
      <TopBar back={`/g/${groupId}/anggota`} title={group.name} />
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-ink-black bg-ink-black text-lead text-cream-paper" aria-hidden="true">
          {initials(profile.displayName)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title break-words">{profile.displayName}</h1>
          <p className="flex flex-wrap gap-2">
            {profile.role === "admin" && <Badge tone="accent">Admin</Badge>}
            {profile.userId === null && <Badge tone="outline">Tamu</Badge>}
            {profile.grade && <Badge>Grade {profile.grade}</Badge>}
            {profile.id === me && <Badge>Kamu</Badge>}
            {!profile.isActive && <Badge tone="muted">Tidak aktif</Badge>}
          </p>
        </div>
      </div>

      <Split
        variant="half"
        main={
          <>
            <Card className="flex items-center gap-4" data-testid="profile-kiko">
              <span className="flex size-24 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-ink-black bg-sandstone">
                <Kiko level={kiko.progress.level} mood={kiko.mood} outfit={kiko.outfit} size={92} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="text-lead">
                  Kiko · Lv {kiko.progress.level} {kiko.progress.name}
                </h2>
                <p className="text-small">
                  {new Intl.NumberFormat("id-ID").format(kiko.xp.xp)} XP · streak {kiko.streak} minggu
                </p>
                {profile.id === me && (
                  <Link href={`/g/${groupId}/kiko`} className={textLinkClass}>
                    Atur kostum Kiko
                  </Link>
                )}
              </div>
            </Card>

            {isAdmin && profile.userId === null && profile.isActive && (
              <ClaimLink groupId={groupId} memberId={profile.id} name={profile.displayName} />
            )}

            {mine.length === 0 ? (
              <Card>
                <p className="text-ui">Belum ada match ganda yang tercatat.</p>
              </Card>
            ) : (
              <>
                <section aria-labelledby="ringkasan" className="flex flex-col gap-3">
                  <h2 id="ringkasan" className="text-sub">
                    Statistik ganda
                  </h2>
                  <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6 @panel:grid-cols-3" data-testid="profile-stats">
                    {[
                      ["Peringkat", row?.rank ? `#${row.rank}` : "–"],
                      ["Main", String(row?.played ?? 0)],
                      ["Menang", String(row?.won ?? 0)],
                      ["Win rate", formatPercent(row?.winRate ?? 0)],
                      ["Selisih", formatSigned(row?.pointDiff ?? 0)],
                      ["Poin", String(row?.tablePoints ?? 0)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-1 rounded-2xl border border-ink-black bg-pure-white p-3">
                        <dt className="text-caption">{label}</dt>
                        <dd className="text-lead tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <Card className="flex flex-col gap-3">
                  <h2 className="text-lead">Form 5 match terakhir</h2>
                  <FormChips form={form} />
                  <p className="text-small" data-testid="streak">
                    {streak && `${streak.result === "W" ? "Menang" : "Kalah"} ${streak.length} kali beruntun saat ini`}
                    {` · rekor menang beruntun ${longestWinStreak(matches, memberId)}`}
                  </p>
                </Card>

                <Card className="flex flex-col gap-2" data-testid="best-partner">
                  <h2 className="text-lead">Partner terbaik</h2>
                  <p className="text-ui">
                    {partner
                      ? `${name(partner.partnerId)} · ${partner.won} menang dari ${partner.played} main (${formatPercent(partner.winRate)})`
                      : "Belum ada partner yang main bareng minimal 3 kali."}
                  </p>
                </Card>
              </>
            )}
          </>
        }
        aside={
          <>
            {mine.length > 0 && (
              <>
                {rival && h2h && (
                  <section aria-labelledby="h2h" className="flex flex-col gap-3">
                    <h2 id="h2h" className="text-sub">
                      Head-to-head
                    </h2>
                    <LinkSelect
                      label="Lawan"
                      value={`${base}?lawan=${rival}`}
                      options={opponents.map((o) => ({ href: `${base}?lawan=${o.memberId}`, label: `${name(o.memberId)} (${o.played}×)` }))}
                    />
                    <Card className="flex flex-col gap-2" data-testid="h2h">
                      <p className="text-title tabular-nums">
                        {h2h.wonA}–{h2h.wonB}
                      </p>
                      <p className="text-small">
                        {profile.displayName} vs {name(rival)} dalam {h2h.played} pertemuan · poin {h2h.pointsA}–{h2h.pointsB}
                      </p>
                      <ul className="flex flex-col gap-1 text-small">
                        {h2h.matches.slice(0, 5).map((m) => {
                          const side = sideOf(m, memberId)!;
                          return (
                            <li key={m.id} className="flex justify-between gap-3 tabular-nums">
                              <span>
                                {formatShortDateId(m.sessionDate)} · {m.winner === side ? "menang" : "kalah"}
                              </span>
                              <span>{m.games.map((g) => (side === "A" ? `${g.a}–${g.b}` : `${g.b}–${g.a}`)).join(", ")}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  </section>
                )}

                <section aria-labelledby="riwayat" className="flex flex-col gap-3">
                  <h2 id="riwayat" className="text-sub">
                    Riwayat match
                  </h2>
                  <ol className="flex flex-col gap-2" data-testid="profile-history">
                    {[...mine]
                      .reverse()
                      .slice(0, 20)
                      .map((m) => {
                        const side = sideOf(m, memberId)!;
                        const other = side === "A" ? "B" : "A";
                        const partners = m.players[side].filter((id) => id !== memberId);
                        return (
                          <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-4 py-3">
                            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-ink-black text-small ${m.winner === side ? "bg-fresh-grass" : "bg-pure-white"}`}>
                              <span aria-hidden="true">{m.winner === side ? "M" : "K"}</span>
                              <span className="sr-only">{m.winner === side ? "Menang" : "Kalah"}</span>
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1 text-small">
                              <span className="truncate">
                                {partners.length > 0 ? `dengan ${team(partners)} ` : ""}vs {team(m.players[other])}
                              </span>
                              <span>{formatShortDateId(m.sessionDate)}</span>
                            </span>
                            <span className="text-ui tabular-nums">{m.games.map((g) => (side === "A" ? `${g.a}–${g.b}` : `${g.b}–${g.a}`)).join(", ")}</span>
                          </li>
                        );
                      })}
                  </ol>
                </section>
              </>
            )}

            <section aria-labelledby="tagihan" className="flex flex-col gap-3">
              <h2 id="tagihan" className="text-sub">
                Tagihan
              </h2>
              {settlements.length === 0 ? (
                <Card>
                  <p className="text-ui">Belum ada tagihan patungan.</p>
                </Card>
              ) : (
                <>
                  <p className="text-ui" data-testid="balance">
                    {owes > 0 && `Belum dibayar ${formatRupiah(owes)}`}
                    {owes > 0 && owed > 0 && " · "}
                    {owed > 0 && `Belum diterima ${formatRupiah(owed)}`}
                    {owes === 0 && owed === 0 && "Semua tagihan lunas."}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {settlements.slice(0, 20).map((s) => (
                      <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-4 py-3 text-small">
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate">{s.from === memberId ? `Bayar ke ${name(s.to)}` : `Dari ${name(s.from)}`}</span>
                          <Link href={`/g/${groupId}/sesi/${s.sessionId}/patungan`} className={textLinkClass}>
                            {formatShortDateId(s.startsAt)}
                            {s.venue ? ` · ${s.venue}` : ""}
                          </Link>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="text-ui tabular-nums">{formatRupiah(s.amount)}</span>
                          {s.status === "paid" ? <Badge tone="accent">Lunas</Badge> : s.selfReported ? <Badge tone="outline">Menunggu konfirmasi</Badge> : <Badge tone="muted">Belum bayar</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <Link href={`/g/${groupId}/leaderboard?periode=semua`} className={textLinkClass}>
              Lihat leaderboard
            </Link>
          </>
        }
      />
    </Page>
  );
}

/** Admin: tautan klaim untuk tamu yang ditambahkan manual (G6). Sekali pakai. */
async function ClaimLink({ groupId, memberId, name }: { groupId: string; memberId: string; name: string }) {
  const token = await claimTokenOf(groupId, memberId);
  if (!token) return null;
  return (
    <Card className="flex flex-col gap-2" data-testid="claim-link">
      <h2 className="text-lead">Tautan klaim</h2>
      <p className="text-small">Kirim hanya ke {name}. Siapa pun yang membuka tautan ini dan masuk dengan akun bisa mengklaim profil ini.</p>
      <CopyLink url={`${publicEnv().siteUrl}/klaim/${token}`} label="Salin tautan klaim" done="Tautan klaim disalin." />
    </Card>
  );
}
