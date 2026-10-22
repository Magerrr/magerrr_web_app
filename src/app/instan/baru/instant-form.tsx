"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, ButtonLink, Card, Field, dateInputClass, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { joinUrlFromShareUrl } from "../link";
import { ShareLink } from "../share-link";

interface Created {
  groupId: string;
  sessionId: string;
  shareUrl: string;
}

/** Form Mabar Instan → POST /api/sessions/instant. Setelah sukses menampilkan tautan gabung. */
export function InstantForm({ today }: { today: string }) {
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  async function submit(form: FormData) {
    setPending(true);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const result = await sendJson<Created>("/api/sessions/instant", "POST", {
      date: text("date"),
      time: text("time"),
      durationMin: Number(form.get("durationMin")),
      venue: text("venue") || null,
      venueUrl: null,
      venuePoint: null,
      courtCount: Number(form.get("courtCount")),
      playMode: "kocok",
      note: text("note") || null,
      slotCount: Number(form.get("slotCount")),
    });
    setPending(false);
    if (result.ok) {
      toast("Mabar Instan dibuat.");
      setCreated(result.data);
    } else {
      toast.error(result.error);
    }
  }

  if (created) {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-sub">Tautan siap dibagikan</h2>
        <p className="text-ui">Kirim ke grup WhatsApp. Siapa pun yang membukanya cukup mengisi nama untuk ikut.</p>
        <ShareLink url={joinUrlFromShareUrl(created.shareUrl)} />
        <ButtonLink href={`/instan/kelola/${created.sessionId}`} variant="outline">
          Kelola sesi
        </ButtonLink>
        <Link href="/" className="inline-flex min-h-11 items-center self-start text-small underline underline-offset-2">
          Ke beranda
        </Link>
      </Card>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field label="Lokasi (opsional)" htmlFor="venue">
        <input id="venue" name="venue" maxLength={80} autoComplete="off" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tanggal" htmlFor="date">
          <input id="date" name="date" type="date" required defaultValue={today} min={today} className={dateInputClass} />
        </Field>
        <Field label="Jam mulai (WIB)" htmlFor="time">
          <input id="time" name="time" type="time" required defaultValue="19:00" className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Slot" htmlFor="slotCount">
          <input id="slotCount" name="slotCount" type="number" inputMode="numeric" required min={2} max={40} defaultValue={8} className={inputClass} />
        </Field>
        <Field label="Lapangan" htmlFor="courtCount">
          <input id="courtCount" name="courtCount" type="number" inputMode="numeric" required min={1} max={12} defaultValue={1} className={inputClass} />
        </Field>
        <Field label="Durasi (menit)" htmlFor="durationMin">
          <input id="durationMin" name="durationMin" type="number" inputMode="numeric" required min={30} max={720} step={30} defaultValue={120} className={inputClass} />
        </Field>
      </div>
      <Field label="Catatan (opsional)" htmlFor="note" hint="Misalnya level permainan atau yang perlu dibawa.">
        <textarea id="note" name="note" maxLength={500} rows={3} className={`${inputClass} h-auto py-3`} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Membuat…" : "Buat Mabar Instan"}
      </Button>
    </form>
  );
}
