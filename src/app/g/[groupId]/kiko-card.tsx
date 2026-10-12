import Link from "next/link";
import { Kiko } from "@/components/kiko";
import type { KikoMood } from "@/lib/core/mascot";
import type { KikoState } from "@/lib/db/kiko";

const MOOD_LABEL: Record<KikoMood, string> = { sleepy: "Ngantuk", happy: "Semangat", fire: "Membara" };
const xpFormat = new Intl.NumberFormat("id-ID");

/** Kartu Kiko di kolom samping Beranda (desain "Beranda — Tablet/Desktop"): suasana, streak, level, bilah XP. */
export function KikoCard({ groupId, kiko, className = "" }: { groupId: string; kiko: KikoState; className?: string }) {
  const { progress, xp, streak, mood, outfit } = kiko;
  const next = progress.next;
  const percent = Math.round(progress.ratio * 100);
  return (
    <Link
      href={`/g/${groupId}/kiko`}
      className={`items-center gap-3 rounded-3xl border border-fresh-grass bg-pure-white p-4 hover:bg-cream-paper ${className}`}
      data-testid="home-kiko"
    >
      <span className="flex size-26 shrink-0 items-end justify-center overflow-hidden rounded-2xl bg-cream-paper" aria-hidden="true">
        <Kiko level={progress.level} mood={mood} outfit={outfit} size={104} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full border border-coral-pop px-2 py-0.5 text-caption">{MOOD_LABEL[mood]}</span>
          <span className="text-caption">streak {streak} minggu</span>
        </span>
        <span className="text-lead">
          Kiko · Lv {progress.level} {progress.name}
        </span>
        <span
          role="progressbar"
          aria-label="XP menuju level berikutnya"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 overflow-hidden rounded-full bg-sandstone"
        >
          <span className="block h-full rounded-full bg-ink-black" style={{ width: `${percent}%` }} />
        </span>
        <span className="text-caption">
          {next
            ? `${xpFormat.format(xp.xp)} / ${xpFormat.format(next.minXp)} XP · ${xpFormat.format(next.minXp - xp.xp)} XP lagi ke ${next.name}`
            : `${xpFormat.format(xp.xp)} XP · level tertinggi`}
        </span>
      </span>
    </Link>
  );
}
