// Antrian tulis skor offline (BUILD_PLAN Fase 9): skor live & "Simpan hasil" disimpan di perangkat
// (localStorage) sampai server menerimanya, sehingga tidak hilang walau halaman dimuat ulang saat offline.
// Murni terhadap `Storage` yang diberikan, agar bisa diuji tanpa peramban.

export type PendingKind = "score" | "complete";

export interface PendingWrite {
  kind: PendingKind;
  matchId: string;
  url: string;
  method: "PUT" | "POST";
  body: unknown;
  /** urutan penambahan (monoton), bukan jam */
  seq: number;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const QUEUE_KEY = "magerrr:antrian-skor";

export function loadQueue(store: KeyValueStore): PendingWrite[] {
  try {
    const parsed = JSON.parse(store.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((w) => w && typeof w.matchId === "string" && typeof w.url === "string") : [];
  } catch {
    return [];
  }
}

function save(store: KeyValueStore, queue: PendingWrite[]): void {
  try {
    store.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Penyimpanan penuh / diblokir: tetap jalan dengan antrian di memori halaman.
  }
}

/**
 * Tambah tulisan. Skor bersifat absolut → hanya yang terbaru per match yang disimpan.
 * "complete" sudah membawa skor akhir → menggantikan skor tertunda match itu.
 */
export function enqueue(store: KeyValueStore, write: Omit<PendingWrite, "seq">): PendingWrite {
  const queue = loadQueue(store);
  const seq = Math.max(0, ...queue.map((w) => w.seq)) + 1;
  const entry = { ...write, seq };
  const kept = queue.filter((w) => w.matchId !== write.matchId || (write.kind === "score" && w.kind === "complete"));
  // Skor baru setelah "complete" tertunda tidak berarti apa-apa (match sudah ditutup di perangkat ini).
  if (write.kind === "score" && kept.some((w) => w.matchId === write.matchId && w.kind === "complete")) return entry;
  save(store, [...kept, entry]);
  return entry;
}

/** Tulisan tertunda untuk satu match (terbaru), bila ada. */
export function pendingFor(store: KeyValueStore, matchId: string, kind: PendingKind): PendingWrite | null {
  return loadQueue(store).find((w) => w.matchId === matchId && w.kind === kind) ?? null;
}

/** Hapus tulisan yang sudah diterima server (atau ditolak), hanya bila belum ada yang lebih baru. */
export function acknowledge(store: KeyValueStore, write: PendingWrite): void {
  save(
    store,
    loadQueue(store).filter((w) => !(w.matchId === write.matchId && w.kind === write.kind && w.seq <= write.seq)),
  );
}

export type SendResult = { ok: true } | { ok: false; status: number; error: string };

export interface FlushReport {
  sent: PendingWrite[];
  /** ditolak server (4xx): dibuang dari antrian, perlu ditampilkan ke pengguna */
  rejected: { write: PendingWrite; error: string }[];
  /** gagal jaringan / server 5xx: tetap di antrian, coba lagi nanti */
  waiting: boolean;
}

/** Kirim antrian berurutan (opsional hanya satu match). Berhenti di kegagalan jaringan pertama. */
export async function flushQueue(
  store: KeyValueStore,
  send: (write: PendingWrite) => Promise<SendResult>,
  matchId?: string,
): Promise<FlushReport> {
  const report: FlushReport = { sent: [], rejected: [], waiting: false };
  const queue = loadQueue(store)
    .filter((w) => matchId === undefined || w.matchId === matchId)
    .sort((x, y) => x.seq - y.seq);
  for (const write of queue) {
    const result = await send(write);
    if (result.ok) {
      acknowledge(store, write);
      report.sent.push(write);
    } else if (result.status === 0 || result.status >= 500) {
      report.waiting = true;
      break;
    } else {
      acknowledge(store, write);
      report.rejected.push({ write, error: result.error });
    }
  }
  return report;
}
