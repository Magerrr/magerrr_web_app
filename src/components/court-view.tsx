import { cx } from "./button-class";

/** Inisial untuk lingkaran avatar: huruf pertama dua kata pertama. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

function PlayerChip({ name }: { name: string }) {
  return (
    <span className="flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-ink-black bg-pure-white py-1 pr-3 pl-1 text-small text-ink-black">
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-black text-caption text-cream-paper">
        {initials(name)}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

function Half({ names, align }: { names: string[]; align: "left" | "right" }) {
  return (
    <div className={cx("flex min-w-0 flex-col", names.length > 1 ? "justify-around" : "justify-center", align === "left" ? "items-center pr-[4%]" : "items-center pl-[4%]")}>
      {names.map((name, i) => (
        <PlayerChip key={i} name={name} />
      ))}
    </div>
  );
}

/**
 * Lapangan badminton tampak atas (ganda: garis lengkap) dengan pemain di separuh masing-masing.
 * `left`/`right` = nama pemain di ujung kiri/kanan; urutan dalam tim tidak bermakna (tidak melacak servis).
 */
export function CourtView({ left, right, className }: { left: string[]; right: string[]; className?: string }) {
  const label = `Posisi pemain: kiri ${left.join(" dan ")}, kanan ${right.join(" dan ")}.`;
  return (
    <div role="img" aria-label={label} className={cx("relative w-full", className)}>
      <svg viewBox="0 0 1340 610" className="block h-auto w-full rounded-lg" aria-hidden="true">
        <rect width="1340" height="610" rx="12" className="fill-fresh-grass" />
        <g className="fill-none stroke-pure-white" strokeWidth="8">
          <rect x="12" y="12" width="1316" height="586" />
          {/* garis samping tunggal */}
          <line x1="12" y1="58" x2="1328" y2="58" />
          <line x1="12" y1="552" x2="1328" y2="552" />
          {/* garis servis pendek & panjang ganda */}
          <line x1="472" y1="12" x2="472" y2="598" />
          <line x1="868" y1="12" x2="868" y2="598" />
          <line x1="88" y1="12" x2="88" y2="598" />
          <line x1="1252" y1="12" x2="1252" y2="598" />
          {/* garis tengah */}
          <line x1="12" y1="305" x2="472" y2="305" />
          <line x1="868" y1="305" x2="1328" y2="305" />
        </g>
        {/* net */}
        <line x1="670" y1="0" x2="670" y2="610" className="stroke-ink-black" strokeWidth="10" strokeDasharray="18 8" />
      </svg>
      <div className="absolute inset-0 grid grid-cols-2 p-[3%]">
        <Half names={left} align="left" />
        <Half names={right} align="right" />
      </div>
    </div>
  );
}
