"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PointBadge } from "@/components/point-badge";
import { SERVICE_COURT_LABEL, ShuttleIcon } from "@/components/shuttle-icon";
import { useBusy } from "@/components/busy";
import { Button, Notice, Spinner, textButtonClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { acknowledge, enqueue, flushQueue, pendingFor, type KeyValueStore } from "@/lib/offline-queue";
import { gameWinner, matchWinner } from "@/lib/core/rules";
import { addPoint, currentGame, pointStatus, removePoint, servePosition, sideChange } from "@/lib/core/scoring";
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
/** Skor + pihak yang servis (ALGORITHMS §1e); keduanya dikirim bersama sebagai nilai absolut. */
interface LiveState {
  games: GameScore[];
  serving: Side | null;
}

function useLiveScore(matchId: string, base: string, initial: LiveState, onCompleted: () => void) {
  const [state, setState] = useState(initial);
  const { games, serving } = state;
  const [history, setHistory] = useState<LiveState[]>([]);
  const [sync, setSync] = useState<SyncState>({ state: "saved" });
  const [completeQueued, setCompleteQueued] = useState(false);
  const store = useRef<KeyValueStore | null>(null);
  const queue = useRef<{ inflight: boolean; again: boolean; timer: number | null }>({ inflight: false, again: false, timer: null });

  const flush = useCallback(
    async function run(): Promise<void> {
      const q = queue.current;
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
      const body = score.body as { games: GameScore[]; serving?: Side | null };
      setState({ games: body.games, serving: body.serving ?? null });
      if (done) setCompleteQueued(true);
      void flush();
    }
  }, [matchId, flush]);

  useEffect(() => {
    const online = () => void flush();
    const q = queue.current;
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      if (q.timer) window.clearTimeout(q.timer);
    };
  }, [flush]);

  function push(next: LiveState) {
    setState(next);
    if (store.current) enqueue(store.current, { kind: "score", matchId, url: `${base}/score`, method: "PUT", body: next });
    void flush();
  }

  function change(next: LiveState) {
    if ((next.games === games && next.serving === serving) || completeQueued) return;
    setHistory((h) => [...h, state]);
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
    for (let i = 0; i < 50 && queue.current.inflight; i++) await new Promise((r) => setTimeout(r, 100));
    const kv = store.current;
    if (!kv) return;
    for (const kind of ["score", "complete"] as const) {
      const w = pendingFor(kv, matchId, kind);
      if (w) acknowledge(kv, w);
    }
  }

  return { games, serving, change, undo, canUndo: history.length > 0 && !completeQueued, sync, retry: () => void flush(), complete, completeQueued, discard };
}

/*
 * Lapangan yang sedang mode fokus ("<sesi>:<lapangan>"), disimpan per tab agar tetap fokus saat rotasi memulai
 * match berikutnya di lapangan yang sama (komponen dipasang ulang) atau halaman dimuat ulang.
 */
const FOCUS_KEY = "magerrr:fokus-lapangan";
let focusedCourt: string | null | undefined;
const focusListeners = new Set<() => void>();
function readFocused(): string | null {
  if (focusedCourt === undefined) {
    try {
      focusedCourt = window.sessionStorage.getItem(FOCUS_KEY);
    } catch {
      focusedCourt = null;
    }
  }
  return focusedCourt;
}
function writeFocused(value: string | null) {
  focusedCourt = value;
  try {
    if (value === null) window.sessionStorage.removeItem(FOCUS_KEY);
    else window.sessionStorage.setItem(FOCUS_KEY, value);
  } catch {
    // tanpa sessionStorage: cukup di memori halaman
  }
  focusListeners.forEach((l) => l());
}
const subscribeFocus = (l: () => void) => {
  focusListeners.add(l);
  return () => void focusListeners.delete(l);
};

/**
 * Mode fokus: kartu skor menutupi seluruh layar (dan memakai Fullscreen API bila tersedia) agar pencatat hanya
 * melihat kontrol skor. Esc atau keluar dari layar penuh peramban juga menutup mode fokus.
 */
function useFocusMode(court: string) {
  const focus = useSyncExternalStore(subscribeFocus, () => readFocused() === court, () => false);
  const setFocus = useCallback((on: boolean) => writeFocused(on ? court : null), [court]);
  const usedFullscreen = useRef(false);
  const exitButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focus) return;
    // Dipulihkan setelah pasang ulang: layar penuh yang masih aktif tetap milik mode fokus ini.
    usedFullscreen.current = document.fullscreenElement !== null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    exitButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setFocus(false);
    };
    const onFullscreen = () => {
      if (usedFullscreen.current && !document.fullscreenElement) {
        usedFullscreen.current = false;
        setFocus(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [focus, setFocus]);

  async function enter() {
    setFocus(true);
    if (!document.fullscreenEnabled || document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
      usedFullscreen.current = true;
    } catch {
      // Ditolak peramban: mode fokus tetap menutupi halaman tanpa layar penuh.
    }
  }

  async function exit() {
    setFocus(false);
    if (usedFullscreen.current && document.fullscreenElement) {
      usedFullscreen.current = false;
      await document.exitFullscreen().catch(() => undefined);
    }
  }

  return { focus, enter, exit, exitButton };
}

function FocusIcon({ exit }: { exit: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {exit ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}

export function LiveCourt({
  groupId,
  sessionId,
  courtNo,
  match,
  names,
  rotation,
  tag = null,
  canVoid = true,
  focusExtra = null,
}: {
  groupId: string;
  sessionId: string;
  courtNo: number;
  match: LiveMatchView;
  names: Names;
  rotation: boolean;
  /** label tambahan, mis. "Turnamen · Semifinal 1" */
  tag?: string | null;
  /** tombol "Batalkan match" (admin saja; pencatat skor pemain tidak) */
  canVoid?: boolean;
  /** isi tambahan khusus mode fokus, mis. penghitung kok admin */
  focusExtra?: ReactNode;
}) {
  const router = useRouter();
  const base = `/api/groups/${groupId}/sessions/${sessionId}/matches/${match.id}`;
  const refresh = useCallback(() => router.refresh(), [router]);
  const live = useLiveScore(match.id, base, { games: match.games, serving: match.serving }, refresh);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useBusy(pending);
  /** Ganti sisi (SC5) akibat perubahan skor terakhir; hilang di perubahan berikutnya. */
  const [turn, setTurn] = useState<"game" | "interval" | null>(null);
  const format = { games: match.gamesMax };
  const winner = matchWinner(live.games, match.rules, format);
  const current = currentGame(live.games);
  const label = (side: Side) => teamLabel(match.players[side], names);
  const wins = (side: Side) => live.games.filter((g) => gameWinner(g.a, g.b, match.rules) === side).length;
  const leading = current.a === current.b ? null : current.a > current.b ? "A" : "B";
  const points = pointStatus(live.games, match.rules, format);
  const serve = servePosition(live.games, live.serving, match.rules, format);
  const { focus, enter, exit, exitButton } = useFocusMode(`${sessionId}:${courtNo}`);

  /** `rally` = sisi yang mencetak poin: ia yang servis berikutnya (ALGORITHMS §1e); −1 tidak mengubah servis. */
  function score(next: GameScore[], rally?: Side) {
    if (next === live.games || live.completeQueued) return;
    setTurn(sideChange(live.games, next, match.rules, format));
    live.change({ games: next, serving: rally ?? live.serving });
  }

  /** Servis awal / koreksi (ALGORITHMS §1e). */
  function setServe(side: Side) {
    setTurn(null);
    live.change({ games: live.games, serving: side });
  }

  function undo() {
    setTurn(null);
    live.undo();
  }

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
    <section
      aria-label={`Lapangan ${courtNo}`}
      aria-modal={focus || undefined}
      role={focus ? "dialog" : undefined}
      data-testid={`court-${courtNo}`}
      className={`flex flex-col gap-3 border-ink-black bg-ink-black text-cream-paper [&_*:focus-visible]:outline-fresh-grass ${
        focus ? "fixed inset-0 z-40 overflow-y-auto p-4 sm:p-6" : "rounded-2xl border p-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className={focus ? "text-sub" : "text-ui"}>Lapangan {courtNo}</h3>
          <p className="text-small">
            {match.gamesMax > 1 ? `Game ${current.no} · best of ${match.gamesMax}` : `${match.rules.target} poin`}
          </p>
        </div>
        {focus ? (
          <button
            ref={exitButton}
            type="button"
            onClick={() => void exit()}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-cream-paper px-4 text-ui transition-colors hover:bg-fresh-grass hover:text-ink-black"
          >
            <FocusIcon exit />
            Keluar fokus
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enter()}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-cream-paper px-4 text-small transition-colors hover:bg-fresh-grass hover:text-ink-black"
          >
            <FocusIcon exit={false} />
            Mode fokus
          </button>
        )}
      </div>
      {tag && <p className="text-small">{tag}</p>}
      {turn && (
        <Notice>
          Ganti sisi lapangan:{" "}
          {turn === "game" ? `game ${current.no} dimulai.` : `skor mencapai ${Math.ceil(match.rules.target / 2)} di game penentu.`}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((side) => (
          <button
            key={side}
            type="button"
            disabled={winner !== null || live.completeQueued}
            onClick={() => score(addPoint(live.games, side, match.rules, format), side)}
            className={`flex flex-col items-center justify-between gap-2 rounded-2xl border-2 bg-pure-ink p-3 disabled:cursor-default ${focus ? "min-h-[45dvh]" : "min-h-40"} ${
              leading === side ? "border-fresh-grass" : "border-pure-ink"
            }`}
          >
            {/* Nama aksesibel = "Tambah poin" + teks yang terlihat (WCAG 2.5.3). */}
            <span className="text-center text-small">
              <span className="sr-only">Tambah poin </span>
              {label(side)}
            </span>
            <span
              className={`tabular-nums ${focus ? "text-[min(28vw,24dvh)] leading-none font-medium tracking-[-0.06em]" : "text-display"} ${leading === side ? "text-fresh-grass" : "text-cream-paper"}`}
              data-testid={`score-${side}`}
            >
              {side === "A" ? current.a : current.b}
            </span>
            <span className="flex flex-col items-center gap-1">
              {serve?.side === side && (
                <span className="flex items-center gap-1 text-caption" data-testid={`serve-${side}`}>
                  <ShuttleIcon className="size-5 text-sunshine-pop" />
                  Servis {SERVICE_COURT_LABEL[serve.court]}
                </span>
              )}
              <PointBadge kind={points[side]} />
              <span className="text-caption">{match.gamesMax > 1 ? `${wins(side)} game` : winner ? "" : "Tap +1"}</span>
            </span>
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

      {/* accent (hijau penuh): secondary transparan di atas kartu ink-black membuat teks ink tidak terbaca. */}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="accent" onClick={() => score(removePoint(live.games, "A", match.rules))}>
          −1<span className="sr-only"> kurangi poin {label("A")}</span>
        </Button>
        <Button variant="accent" onClick={undo} disabled={!live.canUndo}>
          Undo
        </Button>
        <Button variant="accent" onClick={() => score(removePoint(live.games, "B", match.rules))}>
          −1<span className="sr-only"> kurangi poin {label("B")}</span>
        </Button>
      </div>

      {!winner &&
        (live.serving === null ? (
          <div className="flex flex-col gap-2">
            <p className="text-small">Siapa servis duluan?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as const).map((side) => (
                <Button key={side} variant="accent" onClick={() => setServe(side)} disabled={live.completeQueued}>
                  <ShuttleIcon className="size-5" />
                  <span className="truncate">{label(side)}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <Button variant="accent" onClick={() => setServe(live.serving === "A" ? "B" : "A")} disabled={live.completeQueued}>
            <ShuttleIcon className="size-5" />
            Pindah servis
          </Button>
        ))}

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
          <Button variant="accent" onClick={live.retry}>
            Coba lagi
          </Button>
        )}
        {live.sync.state === "rejected" && (
          <Button variant="accent" onClick={() => router.refresh()}>
            Muat ulang
          </Button>
        )}
        {canVoid && (
          <button type="button" onClick={voidMatch} disabled={pending} aria-busy={pending || undefined} className={textButtonClass}>
            {pending && <Spinner />}
            Batalkan match
          </button>
        )}
      </div>
      {focus && focusExtra}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
