// Tampilan turnamen (sistem gugur, round robin, grup + gugur): bagan, klasemen grup, jadwal, klasemen akhir.
// Dipakai halaman anggota & halaman publik.
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, bleedX } from "@/components/ui";
import { roundName, slotName, type SlotState } from "@/lib/core/bracket";
import type { Pool } from "@/lib/core/roundrobin";
import { groupLetter, type ScheduleItem, type Source, type TournamentFormat } from "@/lib/core/tournament";
import type { GameScore } from "@/lib/core/types";
import type { TournamentView } from "@/lib/db/tournaments";
import { formatSigned } from "@/lib/format";

type Names = Record<string, string>;

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  knockout: "Sistem gugur",
  round_robin: "Round robin",
  groups_knockout: "Grup + gugur",
};

export function entryLabel(view: TournamentView, seed: number | null, names: Names): string {
  if (seed === null) return "–";
  return view.entries[seed - 1].players.map((id) => names[id] ?? "?").join(" / ");
}

const sourceLabel = (source: Source) => `${source.place === 1 ? "Juara" : "Runner-up"} Grup ${groupLetter(source.group)}`;

/** Judul satu match: "Partai 3", "Semifinal 1". */
export function itemTitle(view: TournamentView, item: ScheduleItem): string {
  if (item.link.stage === "knockout") return slotName(item.link.round, item.link.slot, view.roundCount);
  return `Partai ${item.no}`;
}

/** Keterangan match round robin / grup: "Grup A · Ronde 2", "Ronde 2"; null untuk bagan. */
export function itemDetail(item: ScheduleItem): string | null {
  if (item.link.stage === "knockout") return null;
  return item.group !== null ? `Grup ${groupLetter(item.group)} · Ronde ${item.round}` : `Ronde ${item.round}`;
}

const STATE_LABEL: Record<SlotState, string> = {
  bye: "Lolos otomatis",
  waiting: "Menunggu",
  ready: "Siap main",
  running: "Sedang main",
  done: "Selesai",
  conflict: "Perlu dicek",
};
const STATE_TONE = { bye: "muted", waiting: "muted", ready: "neutral", running: "accent", done: "neutral", conflict: "outline" } as const;

const scoreOf = (games: GameScore[] | undefined, side: "a" | "b") => (games ?? []).map((g) => g[side]).join(" ");

/** Peserta yang belum diketahui di bagan: asal grup (babak 1 grup + gugur), bye, atau pemenang slot pengumpan. */
function placeholder(view: TournamentView, round: number, slot: number, side: "a" | "b"): string {
  const position = slot * 2 + (side === "a" ? 0 : 1);
  if (round === 1) return view.sources ? sourceLabel(view.sources[position]) : "Bye";
  return `Pemenang ${slotName(round - 1, position, view.roundCount)}`;
}

function EntryRow({ label, seed, won, score }: { label: string; seed: number | null; won: boolean; score: string }) {
  const known = seed !== null;
  return (
    <div className={`flex min-h-9 items-center gap-2 rounded-full px-3 text-small ${won ? "bg-fresh-grass font-medium" : known ? "bg-pure-white" : "border border-dashed border-ink-black"}`}>
      {won && <span className="sr-only">Pemenang: </span>}
      {known && <span className="text-caption tabular-nums">[{seed}]</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="tabular-nums">{score}</span>
    </div>
  );
}

function ItemRows({ view, item, names }: { view: TournamentView; item: ScheduleItem; names: Names }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-sandstone p-1.5">
      {(["a", "b"] as const).map((side) => {
        const seed = item[side];
        const label =
          seed !== null ? entryLabel(view, seed, names) : item.link.stage === "knockout" ? placeholder(view, item.link.round, item.link.slot, side) : "–";
        return (
          <EntryRow
            key={side}
            label={label}
            seed={seed}
            won={item.winner !== null && seed === item.winner && item.state !== "bye"}
            score={item.state === "conflict" ? "" : scoreOf(item.match?.games, side)}
          />
        );
      })}
    </div>
  );
}

/** Bagan: satu kolom per babak, slot sejajar dengan pasangan slot pengumpannya. Bisa digeser ke samping. */
export function BracketBoard({ view, names }: { view: TournamentView; names: Names }) {
  if (!view.bracket) return null;
  return (
    <div role="region" aria-label="Bagan turnamen" tabIndex={0} className={`${bleedX} overflow-x-auto pb-2`} data-testid="bracket">
      <div className="flex w-max gap-3 rounded-2xl border border-ink-black bg-ink-black p-3">
        {view.bracket.rounds.map((slots, r) => (
          <section key={r} aria-label={roundName(r + 1, view.roundCount)} className="flex w-48 shrink-0 flex-col gap-2">
            <h3 className="text-caption text-cream-paper">{roundName(r + 1, view.roundCount)}</h3>
            <ol className="flex flex-1 flex-col justify-around gap-3">
              {slots.map((slot) => (
                <li key={slot.slot} className="flex flex-col gap-1 rounded-2xl bg-sandstone p-1.5" data-testid={`bracket-slot-${slot.round}-${slot.slot}`}>
                  {(["a", "b"] as const).map((side) => (
                    <EntryRow
                      key={side}
                      label={slot[side] !== null ? entryLabel(view, slot[side], names) : placeholder(view, slot.round, slot.slot, side)}
                      seed={slot[side]}
                      won={slot.winner !== null && slot[side] === slot.winner && slot.state !== "bye"}
                      score={slot.state === "conflict" ? "" : scoreOf(slot.match?.games, side)}
                    />
                  ))}
                </li>
              ))}
            </ol>
          </section>
        ))}
        <section aria-label="Juara" className="flex w-36 shrink-0 flex-col gap-2">
          <h3 className="text-caption text-cream-paper">Juara</h3>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <svg width="54" height="40" viewBox="0 0 60 44" fill="none" aria-hidden="true">
              <path d="M18 4h24v12a12 12 0 0 1-24 0z" fill="var(--color-fresh-grass)" />
              <path d="M18 8H10a8 8 0 0 0 8 10M42 8h8a8 8 0 0 1-8 10" stroke="var(--color-fresh-grass)" strokeWidth="3" />
              <path d="M26 28h8v6h-8zM20 36h20v6H20z" fill="var(--color-fresh-grass)" />
            </svg>
            <p className="text-small text-cream-paper" data-testid="bracket-champion">
              {view.champion !== null ? entryLabel(view, view.champion, names) : "Belum ada"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Klasemen satu grup / liga round robin. Peringkat: menang, adu langsung, selisih gim, selisih poin.
 * `advance` menandai yang lolos ke bagan setelah grup selesai.
 */
export function PoolTable({ view, pool, names, title, advance }: { view: TournamentView; pool: Pool; names: Names; title?: string; advance?: number }) {
  const started = pool.table.some((r) => r.played > 0);
  return (
    <section aria-label={title ?? "Klasemen"} className="flex w-full min-w-0 flex-col gap-2 @panel:max-w-3xl" data-testid="pool-table">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lead">{title}</h3>
          {pool.complete ? <Badge tone="neutral">Selesai</Badge> : started && <Badge tone="muted">Sementara</Badge>}
        </div>
      )}
      <ol className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white">
        {pool.table.map((row) => {
          const through = pool.complete && advance !== undefined && row.place <= advance;
          const champion = pool.complete && advance === undefined && row.place === 1;
          return (
            <li key={row.seed} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-ink-black text-small tabular-nums ${through || champion ? "bg-fresh-grass" : "bg-pure-white"}`}
              >
                {row.place}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ui">{entryLabel(view, row.seed, names)}</span>
                <span className="text-caption">
                  {through ? "Lolos · " : champion ? "Juara · " : ""}
                  {row.played} main · gim {formatSigned(row.gamesWon - row.gamesLost)} · poin {formatSigned(row.pointsFor - row.pointsAgainst)}
                </span>
              </span>
              <span className="text-small tabular-nums" aria-label={`${row.won} menang, ${row.lost} kalah`}>
                {row.won}–{row.lost}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Semua grup fase grup, masing-masing dengan klasemennya. */
export function PoolGroups({ view, names }: { view: TournamentView; names: Names }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-x-6" data-testid="tournament-groups">
      {view.pools.map((pool, g) => (
        <PoolTable key={g} view={view} pool={pool} names={names} title={`Grup ${groupLetter(g)}`} advance={view.groups?.advance} />
      ))}
      <p className="text-caption md:col-span-2">
        {view.groups?.advance === 2 ? "Juara & runner-up" : "Juara"} tiap grup lolos ke babak gugur. Peringkat grup: jumlah menang, lalu adu langsung, selisih gim, selisih poin.
      </p>
    </div>
  );
}

/**
 * Jadwal: semua match (tanpa bye) dalam urutan main. `action` merender kontrol tambahan per match
 * (mis. tombol mulai untuk admin); `scoreboardHref` menautkan match yang sedang berjalan.
 */
export function TournamentSchedule({
  view,
  names,
  action,
  scoreboardHref,
}: {
  view: TournamentView;
  names: Names;
  action?: (item: ScheduleItem) => ReactNode;
  scoreboardHref?: string;
}) {
  const courtOf = (item: ScheduleItem) => (item.match ? view.courtOf[item.match.matchId] : null);
  return (
    <ol className="grid gap-3 md:grid-cols-2 @5xl:grid-cols-3" data-testid="tournament-schedule">
      {view.schedule.map((item) => (
        <li key={item.key} className="flex flex-col gap-2 rounded-2xl border border-ink-black bg-pure-white p-4" data-testid="schedule-item">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lead">{itemTitle(view, item)}</h3>
            <Badge tone={STATE_TONE[item.state]}>{STATE_LABEL[item.state]}</Badge>
          </div>
          {itemDetail(item) && <p className="-mt-1 text-small">{itemDetail(item)}</p>}
          <ItemRows view={view} item={item} names={names} />
          {item.state === "running" && (
            <p className="text-small">
              {courtOf(item) ? `Lapangan ${courtOf(item)}` : "Sedang dimainkan"}
              {scoreboardHref && (
                <>
                  {" · "}
                  <Link href={scoreboardHref} className="underline underline-offset-2">
                    buka papan skor
                  </Link>
                </>
              )}
            </p>
          )}
          {item.state === "conflict" && (
            <p className="rounded-lg border-1 border-coral-pop px-3 py-2 text-small" role="note">
              Tim di match ini tidak cocok dengan jadwal ({item.link.stage === "knockout" && item.round === 1 && view.sources ? "hasil fase grup" : "hasil sebelumnya"}{" "}
              berubah). Batalkan match ini di papan skor agar bisa dimainkan ulang.
            </p>
          )}
          {action?.(item)}
        </li>
      ))}
    </ol>
  );
}

function placeLabel(view: TournamentView, place: number | null, groupPlace: number | null, seed: number): string {
  if (place === null) return "Masih bertanding";
  if (place === 1) return "Juara";
  if (groupPlace !== null) return `Gugur di fase grup · peringkat ${groupPlace} Grup ${groupLetter(view.entries[seed - 1].group ?? 0)}`;
  if (view.format === "round_robin") return `Peringkat ${place}`;
  if (place === 2) return "Finalis";
  const round = view.roundCount - Math.log2(place - 1);
  return `Kalah di ${roundName(round, view.roundCount).toLowerCase()}`;
}

/** Klasemen akhir: babak terakhir yang dicapai (gugur) / peringkat grup bagi yang tidak lolos. */
export function TournamentStandings({ view, names }: { view: TournamentView; names: Names }) {
  return (
    <ol className="flex w-full flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white @panel:max-w-3xl" data-testid="tournament-standings">
      {view.standings.map((row) => (
        <li key={row.seed} className="flex min-h-14 items-center gap-3 px-4 py-2">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-ink-black text-small tabular-nums ${row.place === 1 ? "bg-fresh-grass" : "bg-pure-white"}`}>
            {row.place ?? "–"}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-ui">{entryLabel(view, row.seed, names)}</span>
            <span className="text-caption">{placeLabel(view, row.place, row.groupPlace, row.seed)}</span>
          </span>
          <span className="text-small tabular-nums" aria-label={`${row.won} menang, ${row.lost} kalah`}>
            {row.won}–{row.lost}
          </span>
        </li>
      ))}
    </ol>
  );
}
