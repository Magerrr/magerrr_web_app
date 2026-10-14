"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { seasonSchema } from "@/lib/validation";

export function NewSeasonForm({ groupId, defaultName, today }: { groupId: string; defaultName: string; today: string }) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = seasonSchema.safeParse({ name, startsOn, endsOn: endsOn || null });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Data belum lengkap.");
    setPending(true);
    setError(null);
    const result = await sendJson(`/api/groups/${groupId}/seasons`, "POST", parsed.data);
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-2xl border border-ink-black bg-pure-white p-5" data-testid="season-form">
      <h2 className="text-sub">Mulai musim baru</h2>
      <Field label="Nama musim" htmlFor={`${id}-name`}>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} required />
      </Field>
      <Field label="Mulai" htmlFor={`${id}-start`}>
        <input id={`${id}-start`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputClass} required />
      </Field>
      <Field label="Selesai (opsional)" htmlFor={`${id}-end`} hint="Kosongkan bila musim berjalan sampai ditutup manual.">
        <input id={`${id}-end`} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputClass} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Menyimpan…" : "Mulai musim"}
      </Button>
    </form>
  );
}

export function CloseSeasonButton({ groupId, seasonId, name }: { groupId: string; seasonId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function close() {
    if (!window.confirm(`Tutup ${name}? Juara musim ditetapkan dari klasemen saat ini dan musim masuk arsip.`)) return;
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/seasons/${seasonId}`, "PATCH", { action: "close" });
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={close} loading={pending}>
        Tutup musim
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
