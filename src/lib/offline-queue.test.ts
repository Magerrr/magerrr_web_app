import { describe, expect, it } from "vitest";
import { QUEUE_KEY, acknowledge, enqueue, flushQueue, loadQueue, pendingFor, type KeyValueStore, type SendResult } from "./offline-queue";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const score = (matchId: string, a: number, b: number) => ({
  kind: "score" as const,
  matchId,
  url: `/m/${matchId}/score`,
  method: "PUT" as const,
  body: { games: [{ a, b }] },
});
const complete = (matchId: string, a: number, b: number) => ({ ...score(matchId, a, b), kind: "complete" as const, url: `/m/${matchId}/complete`, method: "POST" as const });

describe("antrian skor offline", () => {
  it("skor per match: hanya yang terbaru; complete menggantikan skor; skor setelah complete diabaikan", () => {
    const store = memory();
    enqueue(store, score("m1", 1, 0));
    enqueue(store, score("m2", 0, 1));
    enqueue(store, score("m1", 2, 0));
    expect(loadQueue(store).map((w) => [w.matchId, w.kind, w.seq])).toEqual([
      ["m2", "score", 2],
      ["m1", "score", 3],
    ]);
    enqueue(store, complete("m1", 21, 5));
    enqueue(store, score("m1", 22, 5));
    expect(loadQueue(store).map((w) => [w.matchId, w.kind])).toEqual([
      ["m2", "score"],
      ["m1", "complete"],
    ]);
    expect(pendingFor(store, "m1", "complete")?.body).toEqual({ games: [{ a: 21, b: 5 }] });
    expect(pendingFor(store, "m1", "score")).toBeNull();
  });

  it("acknowledge tidak menghapus tulisan yang lebih baru", () => {
    const store = memory();
    const first = enqueue(store, score("m1", 1, 0));
    enqueue(store, score("m1", 2, 0));
    acknowledge(store, first);
    expect(pendingFor(store, "m1", "score")?.body).toEqual({ games: [{ a: 2, b: 0 }] });
  });

  it("isi rusak / bukan array → kosong", () => {
    const store = memory();
    store.setItem(QUEUE_KEY, "{bukan json");
    expect(loadQueue(store)).toEqual([]);
    store.setItem(QUEUE_KEY, '{"a":1}');
    expect(loadQueue(store)).toEqual([]);
  });

  it("flush berurutan: sukses dihapus, 4xx dibuang & dilaporkan, gagal jaringan berhenti dan disimpan", async () => {
    const store = memory();
    enqueue(store, score("m1", 3, 1));
    enqueue(store, complete("m2", 21, 9));
    enqueue(store, score("m3", 4, 4));
    const calls: string[] = [];
    const responses: Record<string, SendResult> = {
      m1: { ok: true },
      m2: { ok: false, status: 409, error: "Match sudah selesai" },
      m3: { ok: false, status: 0, error: "offline" },
    };
    const report = await flushQueue(store, async (w) => {
      calls.push(w.matchId);
      return responses[w.matchId];
    });
    expect(calls).toEqual(["m1", "m2", "m3"]);
    expect(report.sent.map((w) => w.matchId)).toEqual(["m1"]);
    expect(report.rejected).toEqual([{ write: expect.objectContaining({ matchId: "m2" }), error: "Match sudah selesai" }]);
    expect(report.waiting).toBe(true);
    expect(loadQueue(store).map((w) => w.matchId)).toEqual(["m3"]);

    // Hanya satu match.
    enqueue(store, score("m4", 1, 1));
    const only = await flushQueue(store, async () => ({ ok: true }), "m4");
    expect(only.sent.map((w) => w.matchId)).toEqual(["m4"]);
    expect(loadQueue(store).map((w) => w.matchId)).toEqual(["m3"]);
  });

  it("penyimpanan gagal menulis tidak melempar", () => {
    const broken: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => enqueue(broken, score("m1", 1, 0))).not.toThrow();
  });
});
