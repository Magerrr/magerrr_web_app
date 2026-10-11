import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Page, textLinkClass } from "@/components/ui";
import { publicEnv } from "@/lib/env";
import { loadRecap, recapAccess } from "@/lib/db/recap";
import { formatDateId, formatRupiah, formatShortDateId, formatTimeRangeId } from "@/lib/format";
import { perPersonLabel, recapHighlights } from "@/lib/recap-view";
import { RecapVisibility, ShareRecap } from "./recap-actions";

type Props = PageProps<"/s/[token]/recap">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const access = await recapAccess(token);
  const robots = { index: false, follow: false };
  if (!access || access.session.status !== "finished") return { title: "Recap", robots };
  const { session, group } = access;
  const { recap, names } = await loadRecap(group, session);
  const title = `Recap ${group.name} · ${formatShortDateId(session.startsAt)}`;
  const champion = recapHighlights(recap, names).find((h) => h.key === "champion");
  const description = [champion && `${champion.title}: ${champion.value}`, `${recap.totals.matches} match`].filter(Boolean).join(" · ");
  // Gambar pratinjau WhatsApp hanya untuk recap publik (crawler tidak membawa cookie anggota).
  const image = `${publicEnv().siteUrl}/s/${token}/recap/kartu/1x1`;
  return {
    title,
    description,
    robots,
    openGraph: session.recapPublic
      ? { title, description, type: "website", images: [{ url: image, width: 1080, height: 1080, alt: title }] }
      : undefined,
    twitter: session.recapPublic ? { card: "summary_large_image", title, description, images: [image] } : undefined,
  };
}

/** Recap sesi (PRD R1–R5): publik via token bila `recap_public`, selalu terbuka untuk anggota. */
export default async function RecapPage({ params }: Props) {
  const { token } = await params;
  const access = await recapAccess(token);
  if (!access) notFound();
  const { session, group, isMember, isAdmin } = access;
  const sessionHref = `/g/${group.id}/sesi/${session.id}`;

  const header = (
    <div className="flex flex-col gap-2">
      {isMember && (
        <Link href={sessionHref} className={textLinkClass}>
          Kembali ke sesi
        </Link>
      )}
      <p className="text-small">{group.name}</p>
      <h1 className="text-title">Recap mabar</h1>
      <p className="text-ui">
        {formatDateId(session.startsAt)} · {formatTimeRangeId(session.startsAt, session.durationMin)}
        {session.venue ? ` · ${session.venue}` : ""}
      </p>
    </div>
  );

  if (session.status !== "finished") {
    return (
      <Page>
        {header}
        <Card>
          <p className="text-ui">Recap muncul setelah sesi ditutup.</p>
        </Card>
      </Page>
    );
  }

  const { recap, names, matches, participants, publicUrl } = await loadRecap(group, session);
  const highlights = recapHighlights(recap, names);
  const perPerson = perPersonLabel(recap);
  const team = (ids: string[]) => ids.map((id) => names[id] ?? "?").join(" / ");
  const completed = matches.filter((m) => m.status === "completed");
  const cardBase = `/s/${token}/recap/kartu`;
  const showCard = session.recapPublic || isMember;

  return (
    <Page width={showCard ? "wide" : "regular"}>
      {header}

      {/* Desktop: kartu recap di kolom kanan (setinggi 4 baris kiri); bagian lain di kiri sesuai urutan DOM. */}
      <div
        className={
          showCard
            ? "flex flex-col gap-6 @panel:grid @panel:grid-cols-[minmax(0,1fr)_22rem] @panel:grid-rows-[auto_auto_auto_1fr] @panel:items-start @panel:gap-x-8"
            : "flex flex-col gap-6"
        }
      >
        {highlights.length === 0 ? (
          <Card className="@panel:col-start-1">
            <p className="text-ui">Belum ada match yang tercatat di sesi ini.</p>
          </Card>
        ) : (
          <section aria-labelledby="sorotan" className="flex min-w-0 flex-col gap-3 @panel:col-start-1">
            <h2 id="sorotan" className="sr-only">
              Sorotan
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="highlights">
              {highlights.map((h) => (
                <li
                  key={h.key}
                  className={
                    "flex min-w-0 flex-col gap-1 rounded-2xl border border-ink-black p-4 " +
                    (h.key === "champion" ? "col-span-2 bg-fresh-grass sm:col-span-3" : "bg-pure-white")
                  }
                  data-testid={`highlight-${h.key}`}
                >
                  <span className="text-small">{h.title}</span>
                  <span className={`${h.key === "champion" ? "text-title" : "text-lead"} break-words`}>{h.value}</span>
                  <span className="text-small break-words">{h.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(session.recapPublic || isMember) && (
          <section aria-labelledby="kartu" className="flex min-w-0 flex-col gap-3 @panel:col-start-2 @panel:row-span-4 @panel:row-start-1">
            <h2 id="kartu" className="text-sub">
              Kartu recap
            </h2>
            <Image
              src={`${cardBase}/1x1`}
              alt={`Kartu recap ${group.name}`}
              width={1080}
              height={1080}
              unoptimized
              className="h-auto w-full rounded-2xl border border-ink-black"
            />
            <ShareRecap cardBase={cardBase} url={publicUrl} title={`Recap mabar ${group.name}`} token={token} />
            {isAdmin && <RecapVisibility url={`/api/groups/${group.id}/sessions/${session.id}/recap`} value={session.recapPublic} />}
          </section>
        )}

        {completed.length > 0 && (
          <section aria-labelledby="match" className="flex min-w-0 flex-col gap-3 @panel:col-start-1">
            <h2 id="match" className="text-sub">
              Match ({completed.length})
            </h2>
            <ol className="grid gap-2 md:grid-cols-2" data-testid="recap-matches">
              {completed.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-ink-black bg-pure-white px-4 py-3">
                  <span className="w-6 text-small tabular-nums">{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 text-small">
                    <span className={m.winner === "A" ? "font-medium" : ""}>
                      {team(m.players.A)}
                      {m.winner === "A" && " · menang"}
                    </span>
                    <span className={m.winner === "B" ? "font-medium" : ""}>
                      {team(m.players.B)}
                      {m.winner === "B" && " · menang"}
                    </span>
                  </span>
                  <span className="text-ui tabular-nums">{m.games.map((g) => `${g.a}–${g.b}`).join(", ")}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {participants.length > 0 && (
          <section aria-labelledby="peserta" className="flex min-w-0 flex-col gap-3 @panel:col-start-1">
            <h2 id="peserta" className="text-sub">
              Peserta
            </h2>
            <ul className="flex flex-wrap gap-2">
              {[...participants]
                .sort((a, b) => (names[a] ?? "").localeCompare(names[b] ?? "", "id"))
                .map((id) => (
                  <li key={id}>
                    <Badge>{names[id]}</Badge>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {recap.totals.cost > 0 && (
          <section aria-labelledby="patungan" className="flex min-w-0 flex-col gap-3 @panel:col-start-1">
            <h2 id="patungan" className="text-sub">
              Patungan
            </h2>
            <Card className="flex flex-col gap-2" data-testid="recap-money">
              <p className="flex justify-between gap-3 text-ui">
                <span>Total biaya</span>
                <span className="tabular-nums">{formatRupiah(recap.totals.cost)}</span>
              </p>
              {perPerson && (
                <p className="flex justify-between gap-3 text-ui">
                  <span>Per orang</span>
                  <span className="tabular-nums">{perPerson}</span>
                </p>
              )}
              {recap.totals.settlements > 0 && (
                <p className="flex justify-between gap-3 text-ui">
                  <span>Lunas</span>
                  <span className="tabular-nums">
                    {recap.totals.paid}/{recap.totals.settlements} transfer
                  </span>
                </p>
              )}
              <Link href={`/s/${token}/tagihan`} className={textLinkClass}>
                Lihat tagihan
              </Link>
            </Card>
          </section>
        )}
      </div>
    </Page>
  );
}
