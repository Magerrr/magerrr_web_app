"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { acknowledge, enqueue, flushQueue, pendingFor, type KeyValueStore } from "@/lib/offline-queue";
import { gameWinner, matchWinner } from "@/lib/core/rules";
import { addPoint, currentGame, removePoint } from "@/lib/core/scoring";
import type { GameScore, Side } from "@/lib/core/types";
import { teamLabel, type LiveMatchView, type Names } from "./types";

type SyncState = { state: "saved" | "saving" | "offline" } | { state: "rejected"; message: string };

/** localStorage bila tersedia; selain itu antrian hanya di memori halaman. */
function browserStore(): KeyValueStore {
  try {
    const probe = "magerrr:probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  }
}

/**
 * Skor live dengan UI optimistis: state lokal berubah seketika, server menerima nilai absolut semua game.
 * Setiap perubahan & "Simpan hasil" masuk antrian di perangkat (src/lib/offline-queue.ts) sampai server
 * menerimanya; gagal jaringan → coba lagi tiap 3 detik dan saat kembali online, juga setelah halaman dibuka ulang.
 */
function useLiveScore(matchId: string, base: string, initial: GameScore[], onCompleted: () => void) {
  const [games, setGames] = useState(initial);
  const [history, setHistory] = useState<GameScore[][]>([]);
  const [sync, setSync] = useState<SyncState>({ state: "saved" });
  const [completeQueued, setCompleteQueued] = useState(false);
  const store = useRef<KeyValueStore | null>(null);
  const state = useRef<{ inflight: boolean; again: boolean; timer: number | null }>({ inflight: false, again: false, timer: null });

  const flush = useCallback(
    async function run(): Promise<void> {
      const q = state.current;
      const kv = store.current;
      if (!kv) return;
      if (q.inflight) {
        q.again = true;
        return;
      }
      if (q.timer) window.clearTimeout(q.timer);
      q.timer = null;
      if (!pendingFor(kv, matchId, "score") && !pendingFor(kv, matchId, "complete")) return;
      q.inflight = true;
      setSync({ state: "saving" });
      const report = await flushQueue(kv, (w) => sendJson(w.url, w.method as "PUT" | "POST", w.body), matchId);
      q.inflight = false;
      const rejected = report.rejected[0];
      if (report.sent.some((w) => w.kind === "complete")) {
        setCompleteQueued(false);
        setSync({ state: "saved" });
        onCompleted();
        return;
      }
      if (rejected) {
        if (rejected.write.kind === "complete") setCompleteQueued(false);
        setSync({ state: "rejected", message: rejected.error });
        return;
      }
      if (report.waiting) {
        setSync({ state: "offline" });
        q.timer = window.setTimeout(() => void run(), 3000);
        return;
      }
      if (q.again) {
        q.again = false;
        return run();
      }
      setSync({ state: "saved" });
    },
    [matchId, onCompleted],
  );

  // Pulihkan tulisan yang tertunda dari kunjungan sebelumnya (mis. halaman dimuat ulang saat offline).
  useEffect(() => {
    const kv = browserStore();
    store.current = kv;
    const done = pendingFor(kv, matchId, "complete");
    const score = done ?? pendingFor(kv, matchId, "score");
    if (score) {
      setGames((score.body as { games: GameScore[] }).games);
      if (done) setCompleteQueued(true);
      void flush();
    }
  }, [matchId, flush]);

  useEffect(() => {
    const online = () => void flush();
    const q = state.current;
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      if (q.timer) window.clearTimeout(q.timer);
    };
  }, [flush]);

  function push(next: GameScore[]) {
    setGames(next);
    if (store.current) enqueue(store.current, { kind: "score", matchId, url: `${base}/score`, method: "PUT", body: { games: next } });
    void flush();
  }

  function change(next: GameScore[]) {
    if (next === games || completeQueued) return;
    setHistory((h) => [...h, games]);
    push(next);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous || completeQueued) return;
    setHistory((h) => h.slice(0, -1));
    push(previous);
  }

  /** "Simpan hasil": masuk antrian (menggantikan skor tertunda) lalu dikirim; offline → dikirim nanti. */
  function complete() {
    if (store.current) enqueue(store.current, { kind: "complete", matchId, url: `${base}/complete`, method: "POST", body: { games } });
    setCompleteQueued(true);
    void flush();
  }

  /** Batalkan match: tulisan tertunda untuk match ini tidak relevan lagi. */
  async function discard() {
    for (let i = 0; i < 50 && state.current.inflight; i++) await new Promise((r) => setTimeout(r, 100));
    const kv = store.current;
    if (!kv) return;
    for (const kind of ["score", "complete"] as const) {
      const w = pendingFor(kv, matchId, kind);
      if (w) acknowledge(kv, w);
    }
  }

  return { games, change, undo, canUndo: history.length > 0 && !completeQueued, sync, retry: () => void flush(), complete, completeQueued, discard };
}

export function LiveCourt({
  groupId,
  sessionId,
  courtNo,
  match,
  names,
  rotation,
  tag = null,
}: {
  groupId: string;
  sessionId: string;
  courtNo: number;
  match: LiveMatchView;
  names: Names;
  rotation: boolean;
  /** label tambahan, mis. "Turnamen · Semifinal 1" */
  tag?: string | null;
}) {
  const router = useRouter();
  const base = `/api/groups/${groupId}/sessions/${sessionId}/matches/${match.id}`;
  const refresh = useCallback(() => router.refresh(), [router]);
  const live = useLiveScore(match.id, base, match.games, refresh);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const format = { games: match.gamesMax };
  const winner = matchWinner(live.games, match.rules, format);
  const current = currentGame(live.games);
  const label = (side: Side) => teamLabel(match.players[side], names);
  const wins = (side: Side) => live.games.filter((g) => gameWinner(g.a, g.b, match.rules) === side).length;
  const leading = current.a === current.b ? null : current.a > current.b ? "A" : "B";

  async function voidMatch() {
    if (!window.confirm("Batalkan match ini? Match tidak dihitung di klasemen.")) return;
    setPending(true);
    setError(null);
    await live.discard();
    const result = await sendJson(`${base}/void`, "POST", {});
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <section aria-label={`Lapangan ${courtNo}`} data-testid={`court-${courtNo}`} className="flex flex-col gap-3 rounded-2xl border border-ink-black bg-pure-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lead">Lapangan {courtNo}</h3>
        <p className="text-small">
          {match.gamesMax > 1 ? `Game ${current.no} · best of ${match.gamesMax}` : `${match.rules.target} poin`}
        </p>
      </div>
      {tag && <p className="text-small">{tag}</p>}

      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((side) => (
          <button
            key={side}
            type="button"
            disabled={winner !== null || live.completeQueued}
            onClick={() => live.change(addPoint(live.games, side, match.rules, format))}
            className={`flex min-h-40 flex-col items-center justify-between gap-2 rounded-2xl border-2 border-ink-black p-3 disabled:cursor-default ${
              leading === side ? "bg-fresh-grass" : "bg-pure-white"
            }`}
          >
            {/* Nama aksesibel = "Tambah poin" + teks yang terlihat (WCAG 2.5.3). */}
            <span className="text-center text-small">
              <span className="sr-only">Tambah poin </span>
              {label(side)}
            </span>
            <span className="text-display tabular-nums" data-testid={`score-${side}`}>
              {side === "A" ? current.a : current.b}
            </span>
            <span className="text-caption">{match.gamesMax > 1 ? `${wins(side)} game` : winner ? "" : "Tap +1"}</span>
          </button>
        ))}
      </div>

      {live.games.length > 1 && (
        <p className="text-small">
          {live.games
            .slice(0, winner ? undefined : -1)
            .map((g, i) => `G${i + 1} ${g.a}–${g.b}`)
            .join(" · ")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => live.change(removePoint(live.games, "A", match.rules))}>
          −1<span className="sr-only"> kurangi poin {label("A")}</span>
        </Button>
        <Button variant="secondary" onClick={live.undo} disabled={!live.canUndo}>
          Undo
        </Button>
        <Button variant="secondary" onClick={() => live.change(removePoint(live.games, "B", match.rules))}>
          −1<span className="sr-only"> kurangi poin {label("B")}</span>
        </Button>
      </div>

      {winner && (
        <>
          <Notice>
            {label(winner)} menang
            {match.gamesMax > 1 ? ` ${wins(winner)}–${wins(winner === "A" ? "B" : "A")}` : ` ${current.a}–${current.b}`}.
          </Notice>
          {live.completeQueued ? (
            <Notice>Hasil disimpan di perangkat ini dan dikirim otomatis begitu online.</Notice>
          ) : (
            <Button size="lg" onClick={live.complete} disabled={pending}>
              {rotation ? "Selesai · rotasi" : "Simpan hasil"}
            </Button>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption" role="status" data-testid="sync-status">
          {live.sync.state === "saved" && "Tersimpan"}
          {live.sync.state === "saving" && "Menyimpan…"}
          {live.sync.state === "offline" && "Belum tersinkron. Mencoba lagi…"}
          {live.sync.state === "rejected" && live.sync.message}
        </p>
        {live.sync.state === "offline" && (
          <Button variant="secondary" onClick={live.retry}>
            Coba lagi
          </Button>
        )}
        {live.sync.state === "rejected" && (
          <Button variant="secondary" onClick={() => router.refresh()}>
            Muat ulang
          </Button>
        )}
        <button type="button" onClick={voidMatch} disabled={pending} className="min-h-11 px-1 text-small underline underline-offset-4">
          Batalkan match
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
