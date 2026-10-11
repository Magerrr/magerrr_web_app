import { Badge, Notice } from "@/components/ui";
import type { WaitingEntry } from "@/lib/db/play";

type Names = Record<string, string>;

/** "Main berikutnya" / "Setelah 3 game" (mode rotasi). */
function turnLabel(turn: number): string {
  return turn === 0 ? "Main berikutnya" : `Setelah ${turn + 1} game`;
}

function etaLabel(min: number | null): string {
  if (min === null) return "";
  return min < 3 ? "sebentar lagi" : `±${Math.max(5, Math.round(min / 5) * 5)} mnt`;
}

function entryNote(entry: WaitingEntry): string {
  if (entry.turn === null) return `${entry.played}× main`;
  return [turnLabel(entry.turn), etaLabel(entry.etaMin)].filter(Boolean).join(" · ");
}

/** Antrian giliran (PRD SC9): urutan menunggu + kapan turun (rotasi) atau jumlah main (kocok). */
export function WaitingList({
  entries,
  names,
  rotation,
  viewerId = null,
}: {
  entries: WaitingEntry[];
  names: Names;
  rotation: boolean;
  viewerId?: string | null;
}) {
  const hasEta = entries.some((e) => e.etaMin !== null);
  return (
    <section aria-labelledby="menunggu" className="flex flex-col gap-2">
      <h2 id="menunggu" className="text-sub">
        {rotation ? "Antrian berikutnya" : "Istirahat"}
      </h2>
      <ol className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white" data-testid="waiting-list">
        {entries.map((entry, i) => (
          <li key={entry.ids.join("|")} className="flex min-h-11 items-center gap-3 px-4 py-2">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-caption ${entry.turn === 0 ? "bg-fresh-grass" : "bg-sandstone"}`}
            >
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-ui">
              {entry.ids.map((id) => names[id] ?? "?").join(" / ")}
              {viewerId && entry.ids.includes(viewerId) && <Badge tone="accent">Kamu</Badge>}
            </span>
            <span className="shrink-0 text-right text-small">{entryNote(entry)}</span>
          </li>
        ))}
      </ol>
      <p className="text-caption">
        {rotation
          ? `Yang kalah masuk ujung antrian.${hasEta ? " Perkiraan waktu dari durasi match sesi ini." : ""}`
          : "Kocok berikutnya mendahulukan yang paling sedikit main, lalu yang paling lama istirahat."}
      </p>
    </section>
  );
}

/** Posisi pengunjung sendiri: sedang main di lapangan mana, atau antre ke berapa. */
export function MyTurn({
  entries,
  courtNo,
  viewerId,
  rotation,
}: {
  entries: WaitingEntry[];
  courtNo: number | null;
  viewerId: string;
  rotation: boolean;
}) {
  if (courtNo !== null) return <Notice>Kamu sedang main di Lapangan {courtNo}.</Notice>;
  const pos = entries.findIndex((e) => e.ids.includes(viewerId));
  if (pos < 0) return null;
  const entry = entries[pos];
  if (entry.turn !== null) {
    const eta = etaLabel(entry.etaMin);
    return (
      <Notice>
        Kamu antre ke-{pos + 1}: {turnLabel(entry.turn).toLowerCase()}
        {eta && ` (${eta})`}.
      </Notice>
    );
  }
  return (
    <Notice>
      Kamu {rotation ? "antre" : "istirahat"} di urutan ke-{pos + 1} (sudah {entry.played}× main).
    </Notice>
  );
}
