"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBusy } from "@/components/busy";
import { toast } from "@/components/toast";
import { Button, Spinner } from "@/components/ui";
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
  const [pending, setPending] = useState<Rsvp | null>(null);
  useBusy(pending !== null);

  async function pick(rsvp: Rsvp) {
    setPending(rsvp);
    const result = await sendJson(url, "PUT", { rsvp });
    setPending(null);
    if (!result.ok) return toast.error(result.error);
    toast("Jawabanmu disimpan.");
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
            disabled={pending !== null}
            aria-busy={pending === o.value || undefined}
            onClick={() => pick(o.value)}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-ink-black px-2 text-ui transition-colors disabled:cursor-wait ${
              current === o.value ? "bg-ink-black text-cream-paper hover:bg-pure-ink" : "bg-fresh-grass/25 text-ink-black hover:bg-fresh-grass"
            }`}
          >
            {pending === o.value && <Spinner />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Admin: jadikan semua yang menjawab "Ikut" sebagai peserta hadir (tagihan dihitung ulang). */
export function ApplyRsvp({ url, goingIds }: { url: string; goingIds: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function apply() {
    if (!window.confirm(`Jadikan ${goingIds.length} orang yang menjawab "Ikut" sebagai peserta hadir? Peserta lain dihapus centangnya.`)) return;
    setPending(true);
    const result = await sendJson(url, "PUT", { memberIds: goingIds });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast(`${goingIds.length} peserta hadir disimpan.`);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={apply} loading={pending} disabled={goingIds.length === 0}>
        Jadikan yang ikut sebagai peserta
      </Button>
    </div>
  );
}
