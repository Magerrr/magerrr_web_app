import type { Metadata } from "next";
import { Kiko } from "@/components/kiko";
import { NoAccess } from "@/components/no-access";
import { Badge, Card, Page, TopBar } from "@/components/ui";
import { KIKO_XP, defaultOutfit, type KikoMood } from "@/lib/core/mascot";
import { getGroup } from "@/lib/db/groups";
import { loadKiko } from "@/lib/db/kiko";
import { loadGroupMatches } from "@/lib/db/matches";
import { pageAccess } from "../access";
import { KikoStudio } from "./kiko-studio";

export const metadata: Metadata = { title: "Kiko" };

const MOOD_LABEL: Record<KikoMood, string> = { sleepy: "Ngantuk", happy: "Semangat", fire: "Membara" };

function greeting(streak: number): string {
  if (streak === 0) return "Zzz… aku ngantuk. Ikut mabar minggu ini biar aku semangat lagi.";
  if (streak < 4) return `Streak ${streak} minggu! Main lagi minggu ini biar nggak putus.`;
  return `${streak} minggu berturut-turut main. Aku lagi membara!`;
}

const xpFormat = new Intl.NumberFormat("id-ID");

/** Maskot Kiko milik pengunjung: level dari XP, gerak dari streak mingguan, kostum yang bisa diatur. */
export default async function KikoPage({ params }: PageProps<"/g/[groupId]/kiko">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/kiko`} />;
  const { member } = access.membership;
  const [group, matches] = await Promise.all([getGroup(groupId), loadGroupMatches(groupId)]);
  const kiko = await loadKiko(groupId, member.id, matches, new Date());
  const { progress, xp, streak } = kiko;
  const next = progress.next;

  return (
    <Page>
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-title">Kiko</h1>
          <p className="text-small">
            Kucing atletmu · Lv {progress.level} {progress.name}
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1 whitespace-nowrap" data-testid="kiko-streak">
          <Badge tone={streak > 0 ? "accent" : "muted"}>Streak {streak} minggu</Badge>
          <span className="text-caption">{MOOD_LABEL[kiko.mood]}</span>
        </span>
      </div>

      {/* Tablet+: panggung Kiko di samping lemari kostum. */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
        <KikoStudio
          groupId={groupId}
          level={progress.level}
          levelName={progress.name}
          mood={kiko.mood}
          outfit={kiko.outfit}
          custom={kiko.custom}
          greeting={greeting(streak)}
        />
      </div>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
        <Card className="flex items-center gap-4" data-testid="kiko-xp">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap justify-between gap-x-3 text-small">
              <span className="font-medium">{next ? `Menuju Lv ${next.level} · ${next.name}` : "Level tertinggi"}</span>
              <span className="tabular-nums">
                {xpFormat.format(xp.xp)}
                {next ? ` / ${xpFormat.format(next.minXp)}` : ""} XP
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="XP menuju level berikutnya"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.ratio * 100)}
              className="h-2.5 overflow-hidden rounded-full border border-ink-black bg-sandstone"
            >
              <div className="h-full rounded-full bg-ink-black" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
            </div>
            <p className="text-caption">
              {xp.sessions} sesi · {xp.matches} match · {xp.wins} menang
            </p>
          </div>
          {next && (
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-black bg-sandstone" title={`Lv ${next.level} ${next.name}`}>
              <Kiko level={next.level} mood="happy" outfit={defaultOutfit(next.level)} size={56} silhouette />
            </span>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="text-lead">Cara Kiko tumbuh</h2>
          <ul className="flex flex-col gap-1 text-small">
            <li>+{KIKO_XP.session} XP tiap sesi yang kamu hadiri</li>
            <li>+{KIKO_XP.match} XP tiap match selesai, +{KIKO_XP.win} XP lagi kalau menang</li>
            <li>Main tiap minggu menjaga streak: Kiko semangat 1–3 minggu, membara mulai 4 minggu</li>
          </ul>
          <p className="text-caption">Lv 2 di 500 XP, Lv 3 di 1.000 XP, Lv 4 di 1.500 XP. Match yang dibatalkan tidak dihitung.</p>
        </Card>
      </div>
    </Page>
  );
}
