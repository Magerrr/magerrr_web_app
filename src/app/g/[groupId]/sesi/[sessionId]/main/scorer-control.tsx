"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useBusy } from "@/components/busy";
import { Button, Notice, inputBase } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { Names } from "./types";

const ADMIN = "";

/**
 * Pencatat skor satu lapangan (ALGORITHMS §1d): hanya satu orang yang memegang skor.
 * Admin/wasit memilih pemain (atau kembali ke admin/wasit); pemain mengajukan diri saat belum ada pencatat, atau melepasnya.
 */
export function ScorerControl({
  url,
  courtNo,
  scorer,
  viewerId,
  isOfficial,
  present,
  names,
}: {
  url: string;
  courtNo: number;
  scorer: string | null;
  viewerId: string;
  /** admin atau wasit */
  isOfficial: boolean;
  /** peserta hadir yang bisa ditunjuk */
  present: string[];
  names: Names;
}) {
  const router = useRouter();
  const selectId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBusy(pending);
  const mine = scorer === viewerId;
  const holder = scorer === null ? "Admin" : mine ? "Kamu" : (names[scorer] ?? "?");

  async function assign(memberId: string | null) {
    setPending(true);
    setError(null);
    const result = await sendJson(url, "PUT", { memberId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      if (result.status === 409) router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink-black bg-pure-white px-4 py-3" data-testid={`scorer-${courtNo}`}>
      {isOfficial ? (
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor={selectId} className="flex min-w-0 flex-1 flex-col gap-1 text-small">
            Pencatat skor lapangan {courtNo}
            <select
              id={selectId}
              value={scorer ?? ADMIN}
              disabled={pending}
              onChange={(e) => void assign(e.target.value === ADMIN ? null : e.target.value)}
              className={`${inputBase} h-11 w-full px-3 text-ui`}
            >
              <option value={ADMIN}>Admin (host)</option>
              {present.map((id) => (
                <option key={id} value={id}>
                  {names[id] ?? "?"}
                  {id === viewerId ? " (kamu)" : ""}
                </option>
              ))}
            </select>
          </label>
          {scorer !== null && !mine && (
            <Button variant="secondary" onClick={() => void assign(null)} loading={pending}>
              Ambil alih
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-small">
            Pencatat skor: <strong className="font-medium">{holder}</strong>
          </p>
          {scorer === null && present.includes(viewerId) && (
            <Button variant="secondary" onClick={() => void assign(viewerId)} loading={pending}>
              Ajukan jadi pencatat skor
            </Button>
          )}
          {mine && (
            <Button variant="secondary" onClick={() => void assign(null)} loading={pending}>
              Lepas kontrol skor
            </Button>
          )}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
