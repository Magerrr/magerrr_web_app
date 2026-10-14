"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

/** Mulai satu match turnamen (slot bagan / pasangan grup): pilih lapangan kosong, lalu skor dicatat di papan skor. */
export function StartSlot({
  url,
  id,
  target,
  emptyCourts,
  boardHref,
}: {
  url: string;
  id: string;
  target: { round: number; slot: number } | { a: number; b: number };
  emptyCourts: number[];
  boardHref: string;
}) {
  const router = useRouter();
  const [court, setCourt] = useState(emptyCourts[0] ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (emptyCourts.length === 0) return <p className="text-small">Semua lapangan sedang dipakai. Mulai setelah ada lapangan kosong.</p>;

  async function start() {
    if (court === null) return;
    setPending(true);
    setError(null);
    const result = await sendJson(url, "POST", { ...target, courtNo: court });
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push(boardHref);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor={`court-${id.replaceAll(":", "-")}`} className="sr-only">
          Lapangan
        </label>
        <select
          id={`court-${id.replaceAll(":", "-")}`}
          value={court ?? ""}
          onChange={(e) => setCourt(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 rounded-lg border-2 border-ink-black bg-pure-white px-3 text-ui"
        >
          {emptyCourts.map((n) => (
            <option key={n} value={n}>
              Lapangan {n}
            </option>
          ))}
        </select>
        <Button variant="accent" onClick={start} loading={pending}>
          Mulai match
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function DeleteTournament({ url }: { url: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        className="self-start"
        loading={pending}
        onClick={async () => {
          if (!window.confirm("Hapus turnamen ini? Jadwal dan pesertanya dihapus.")) return;
          setPending(true);
          const result = await sendJson(url, "DELETE");
          setPending(false);
          if (!result.ok) return setError(result.error);
          router.refresh();
        }}
      >
        Hapus turnamen
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
