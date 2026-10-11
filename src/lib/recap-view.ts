// Teks sorotan recap untuk halaman & kartu gambar (PRD R2–R3). Data dari `buildRecap`.
import type { GameHighlight, Recap } from "@/lib/core/recap";
import { formatRupiah } from "@/lib/format";

type Names = Record<string, string>;

export type HighlightKey = "champion" | "bestPair" | "tightestGame" | "biggestWin" | "longestWinStreak" | "mostPlayed";

export interface Highlight {
  key: HighlightKey;
  title: string;
  value: string;
  detail: string;
}

const nameOf = (names: Names, id: string) => names[id] ?? "?";
const list = (names: Names, ids: string[]) => ids.map((id) => nameOf(names, id)).join(" & ");
const team = (names: Names, ids: string[]) => ids.map((id) => nameOf(names, id)).join(" / ");

function gameHighlight(g: GameHighlight, names: Names): { value: string; detail: string } {
  const loser = g.winner === "A" ? "B" : "A";
  return {
    value: `${Math.max(g.a, g.b)}–${Math.min(g.a, g.b)}`,
    detail: `${team(names, g.players[g.winner])} atas ${team(names, g.players[loser])}`,
  };
}

/** Kartu sorotan yang punya data, urutan tampil tetap; kosong → tidak ada kartu. */
export function recapHighlights(recap: Recap, names: Names): Highlight[] {
  const out: Highlight[] = [];
  if (recap.champion) {
    const c = recap.champion[0];
    out.push({
      key: "champion",
      title: recap.champion.length > 1 ? "Juara bersama" : "Juara sesi",
      value: list(
        names,
        recap.champion.map((r) => r.memberId),
      ),
      detail: `${c.won} menang dari ${c.played} main · ${c.tablePoints} poin`,
    });
  }
  if (recap.bestPair) {
    const p = recap.bestPair;
    out.push({ key: "bestPair", title: "Pasangan terbaik", value: list(names, p.members), detail: `${p.won} menang dari ${p.played} main bareng` });
  }
  if (recap.tightestGame) out.push({ key: "tightestGame", title: "Rally terketat", ...gameHighlight(recap.tightestGame, names) });
  // Kemenangan terbesar hanya bila berbeda dari rally terketat (satu game saja → sama).
  if (recap.biggestWin && recap.biggestWin.margin !== recap.tightestGame?.margin) {
    out.push({ key: "biggestWin", title: "Kemenangan terbesar", ...gameHighlight(recap.biggestWin, names) });
  }
  // Streak 1 bukan sorotan.
  if (recap.longestWinStreak && recap.longestWinStreak.length >= 2) {
    out.push({
      key: "longestWinStreak",
      title: "Win streak terpanjang",
      value: `${recap.longestWinStreak.length} beruntun`,
      detail: list(names, recap.longestWinStreak.memberIds),
    });
  }
  if (recap.mostPlayed) {
    out.push({ key: "mostPlayed", title: "Paling banyak main", value: `${recap.mostPlayed.played} match`, detail: list(names, recap.mostPlayed.memberIds) });
  }
  return out;
}

/** "Rp35.000/orang" atau rentang; null bila tanpa biaya / tanpa yang perlu transfer. */
export function perPersonLabel(recap: Recap): string | null {
  const values = Object.values(recap.totals.perPerson ?? {});
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${formatRupiah(max)}/orang` : `${formatRupiah(min)}–${formatRupiah(max)}/orang`;
}

/** Isi kartu gambar recap (R4): juara, pasangan terbaik, skor tertipis, jumlah match, patungan per orang. */
export interface CardData {
  groupName: string;
  /** "Jumat, 9 Oktober 2026 · GOR Uji" */
  subtitle: string;
  champion: { title: string; value: string; detail: string } | null;
  stats: { label: string; value: string; detail?: string }[];
}

export function cardData(recap: Recap, names: Names, header: { groupName: string; subtitle: string }): CardData {
  const h = recapHighlights(recap, names);
  const find = (key: HighlightKey) => h.find((x) => x.key === key);
  const champion = find("champion");
  const pair = find("bestPair");
  const tight = find("tightestGame");
  const perPerson = perPersonLabel(recap);
  const stats: CardData["stats"] = [];
  if (pair) stats.push({ label: pair.title, value: pair.value, detail: pair.detail });
  if (tight) stats.push({ label: "Skor tertipis", value: tight.value, detail: tight.detail });
  stats.push({ label: "Jumlah match", value: `${recap.totals.matches} match`, detail: `${recap.totals.games} game` });
  if (perPerson) stats.push({ label: "Patungan", value: perPerson, detail: `Total ${formatRupiah(recap.totals.cost)}` });
  return {
    ...header,
    champion: champion ? { title: champion.title, value: champion.value, detail: champion.detail } : null,
    stats,
  };
}
