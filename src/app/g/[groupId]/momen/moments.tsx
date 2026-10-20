"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useBusy } from "@/components/busy";
import { textButtonClass } from "@/components/button-class";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { resizeImage } from "@/lib/image-resize";

export interface MomentView {
  id: string;
  url: string;
  caption: string | null;
  memberName: string;
  date: string;
  session: string | null;
  canDelete: boolean;
}

/** Form unggah foto momen: foto diperkecil di Perangkat (sisi terpanjang 1600px, JPEG) sebelum dikirim. */
export function MomentUpload({ groupId, sessions }: { groupId: string; sessions: { id: string; label: string }[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Pilih foto dulu.");
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("file", await resizeImage(file, { max: 1600, kind: "photo" }), file.name);
    form.set("caption", caption);
    form.set("sessionId", sessionId);
    try {
      const response = await fetch(`/api/groups/${groupId}/moments`, { method: "POST", body: form });
      if (!response.ok) {
        setError((await response.json().catch(() => ({}))).error ?? "Gagal mengunggah. Coba lagi.");
      } else {
        setCaption("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } catch {
      setError("Tidak ada koneksi. Periksa internet lalu coba lagi.");
    }
    setPending(false);
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-sub">Tambah foto</h2>
      <form action={submit} className="flex flex-col gap-4">
        <Field label="Foto" htmlFor="moment-file">
          <input
            ref={fileRef}
            id="moment-file"
            type="file"
            accept="image/*"
            required
            className="min-h-11 max-w-full text-ui file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-ink-black file:bg-fresh-grass/25 file:px-4 file:text-ui"
          />
        </Field>
        <Field label="Keterangan (opsional)" htmlFor="moment-caption">
          <input id="moment-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} autoComplete="off" className={inputClass} />
        </Field>
        {sessions.length > 0 && (
          <Field label="Sesi (opsional)" htmlFor="moment-session">
            <select id="moment-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={inputClass}>
              <option value="">Tanpa sesi</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" loading={pending} className="sm:self-start">
          {pending ? "Mengunggah…" : "Unggah foto"}
        </Button>
      </form>
    </Card>
  );
}

export function MomentGallery({ groupId, moments }: { groupId: string; moments: MomentView[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useBusy(busy !== null);

  async function remove(id: string) {
    if (!window.confirm("Hapus foto ini?")) return;
    setBusy(id);
    setError(null);
    const result = await sendJson(`/api/groups/${groupId}/moments/${id}`, "DELETE");
    setBusy(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  if (moments.length === 0) {
    return (
      <Card>
        <p className="text-ui">Belum ada foto. Unggah momen mabar pertama grup ini.</p>
      </Card>
    );
  }
  return (
    <section aria-labelledby="galeri" className="flex flex-col gap-3">
      <h2 id="galeri" className="text-sub">
        {moments.length} foto
      </h2>
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="moment-list">
        {moments.map((m) => (
          <li key={m.id} className="min-w-0">
            <figure className="flex h-full flex-col overflow-hidden rounded-2xl border border-ink-black bg-pure-white">
              <a href={m.url} target="_blank" rel="noopener" className="relative block aspect-square bg-sandstone">
                <Image
                  src={m.url}
                  alt={m.caption ?? `Foto dari ${m.memberName}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 288px, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
                <span className="sr-only"> (buka ukuran penuh di tab baru)</span>
              </a>
              <figcaption className="flex flex-1 flex-col gap-1 p-3">
                {m.caption && <span className="text-small break-words text-ink-black">{m.caption}</span>}
                <span className="text-caption">
                  {m.memberName} · {m.date}
                  {m.session ? ` · ${m.session}` : ""}
                </span>
                {m.canDelete && (
                  <button type="button" onClick={() => remove(m.id)} disabled={busy === m.id} aria-busy={busy === m.id || undefined} className={`${textButtonClass} -ml-2 self-start`}>
                    Hapus<span className="sr-only"> foto {m.caption ?? ""}</span>
                  </button>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
