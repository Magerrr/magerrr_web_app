"use client";

import { useId, useRef, useState } from "react";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { shuttleCost } from "@/lib/core/split";
import { formatRupiah } from "@/lib/format";

interface Counter {
  pricePerSlop: number | null;
  perSlop: number;
  used: number;
}

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 8);

/** Penghitung kok per slop (§5.5, desain Session "Kok terpakai X dari 12"). Disimpan absolut, perubahan terakhir menang. */
export function ShuttleCounter({ url, initial, defaultPrice, flatShuttle }: { url: string; initial: Counter; defaultPrice: number | null; flatShuttle: number | null }) {
  const id = useId();
  const [counter, setCounter] = useState<Counter>({ ...initial, pricePerSlop: initial.pricePerSlop ?? defaultPrice });
  const [price, setPrice] = useState(String(initial.pricePerSlop ?? defaultPrice ?? ""));
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(counter);
  const inFlight = useRef(false);

  async function flush() {
    if (inFlight.current) return;
    inFlight.current = true;
    let sent: Counter;
    do {
      sent = latest.current;
      setStatus("saving");
      const result = await sendJson(url, "PUT", sent);
      if (!result.ok) {
        inFlight.current = false;
        setStatus("error");
        setError(result.error);
        return;
      }
    } while (sent !== latest.current);
    inFlight.current = false;
    setStatus("saved");
    setError(null);
  }

  function update(next: Counter) {
    latest.current = next;
    setCounter(next);
    void flush();
  }

  const cost = counter.pricePerSlop ? shuttleCost({ pricePerSlop: counter.pricePerSlop, used: counter.used, perSlop: counter.perSlop }) : null;
  const slop = Math.floor(counter.used / counter.perSlop);
  const inSlop = counter.used % counter.perSlop;

  return (
    <Card className="flex flex-col gap-4" data-testid="shuttle-counter">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lead">Kok</h2>
        <p className="text-small" aria-live="polite">
          {status === "saving" ? "Menyimpan…" : status === "error" ? "Belum tersimpan" : "Tersimpan"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="w-14 text-sub"
          onClick={() => update({ ...counter, used: Math.max(0, counter.used - 1) })}
          disabled={counter.used === 0}
        >
          −<span className="sr-only"> kurangi kok</span>
        </Button>
        <p className="flex flex-1 flex-col items-center">
          <span className="text-title tabular-nums" data-testid="shuttles-used">
            {counter.used}
          </span>
          <span className="text-small">
            terpakai{slop > 0 ? ` · ${slop} slop${inSlop > 0 ? ` + ${inSlop}` : ""}` : ` dari ${counter.perSlop}`}
          </span>
        </p>
        <Button className="w-24" onClick={() => update({ ...counter, used: Math.min(999, counter.used + 1) })}>
          + Kok
        </Button>
      </div>
      <p className="text-ui" data-testid="shuttle-cost">
        {cost === null ? "Isi harga per slop untuk menghitung biaya." : `Biaya kok ${formatRupiah(cost)}`}
      </p>
      <details className="text-small" open={counter.pricePerSlop === null}>
        <summary className="min-h-11 cursor-pointer content-center">Harga per slop</summary>
        <div className="flex flex-col gap-3 pt-2">
          <Field label="Harga per slop (Rp)" htmlFor={`${id}-price`}>
            <input
              id={`${id}-price`}
              inputMode="numeric"
              autoComplete="off"
              value={price}
              onChange={(e) => setPrice(digits(e.target.value))}
              onBlur={() => update({ ...counter, pricePerSlop: price === "" ? null : Number(price) })}
              className={inputClass}
            />
          </Field>
          <Field label="Isi per slop" htmlFor={`${id}-per`}>
            <select
              id={`${id}-per`}
              value={counter.perSlop}
              onChange={(e) => update({ ...counter, perSlop: Number(e.target.value) })}
              className={inputClass}
            >
              {[6, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n} buah
                </option>
              ))}
            </select>
          </Field>
        </div>
      </details>
      <p className="text-caption">Masuk ke patungan sebagai satu biaya saat sesi ditutup (dibulatkan ke atas ke Rp100).</p>
      {flatShuttle !== null && (
        <Notice>Patungan sudah punya biaya kok {formatRupiah(flatShuttle)}. Biaya dari penghitung ini akan ditambahkan terpisah; hapus salah satunya bila dobel.</Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
