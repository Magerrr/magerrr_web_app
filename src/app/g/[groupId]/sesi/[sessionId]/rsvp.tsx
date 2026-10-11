"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

type Rsvp = "going" | "maybe" | "not_going";

const OPTIONS: { value: Rsvp; label: string }[] = [
  { value: "going", label: "Ikut" },
  { value: "maybe", label: "Mungkin" },
  { value: "not_going", label: "Tidak ikut" },
];

/** Jawaban RSVP diri sendiri (S3). */
export function RsvpPicker({ url, value }: { url: string; value: Rsvp | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function pick(rsvp: Rsvp) {
    setPending(true);
    setError(null);
    const result = await sendJson(url, "PUT", { rsvp });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setCurrent(rsvp);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Jawaban kamu" className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={current === o.value}
            disabled={pending}
            onClick={() => pick(o.value)}
            className={`min-h-11 rounded-full border border-ink-black px-2 text-ui ${current === o.value ? "bg-ink-black text-cream-paper" : "bg-pure-white text-ink-black"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

/** Admin: jadikan semua yang menjawab "Ikut" sebagai peserta hadir (tagihan dihitung ulang). */
export function ApplyRsvp({ url, goingIds }: { url: string; goingIds: string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function apply() {
    if (!window.confirm(`Jadikan ${goingIds.length} orang yang menjawab "Ikut" sebagai peserta hadir? Peserta lain dihapus centangnya.`)) return;
    setPending(true);
    const result = await sendJson(url, "PUT", { memberIds: goingIds });
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={apply} disabled={pending || goingIds.length === 0}>
        Jadikan yang ikut sebagai peserta
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
