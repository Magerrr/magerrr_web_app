"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { sendJson } from "@/lib/api-client";
import { resizeImage } from "@/lib/image-resize";

/** Foto profil: dipotong persegi 512px di peramban, lalu diunggah (MAGERRR-12). */
export function AvatarField({ name, url }: { name: string; url: string | null }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setPending("upload");
    setError(null);
    const form = new FormData();
    form.set("file", await resizeImage(file, { max: 512, square: true, kind: "photo" }), file.name);
    try {
      const response = await fetch("/api/profil/foto", { method: "POST", body: form });
      if (!response.ok) setError((await response.json().catch(() => ({}))).error ?? "Gagal mengunggah. Coba lagi.");
      else router.refresh();
    } catch {
      setError("Tidak ada koneksi. Periksa internet lalu coba lagi.");
    }
    setPending(null);
    if (input.current) input.current.value = "";
  }

  async function remove() {
    setPending("remove");
    setError(null);
    const result = await sendJson("/api/profil/foto", "DELETE");
    setPending(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sub">Foto profil</h2>
      <div className="flex items-center gap-4">
        <UserAvatar name={name} url={url} size="lg" className="border border-ink-black" />
        <p className="text-small">Tampil di beranda dan di profilmu untuk anggota grup yang sama.</p>
      </div>
      <label htmlFor={id} className="text-ui font-medium">
        {url ? "Ganti foto" : "Pilih foto"}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/*"
          disabled={pending !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          className="min-h-11 max-w-full text-ui file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-ink-black file:bg-fresh-grass/25 file:px-4 file:text-ui"
        />
        {url && (
          <Button variant="secondary" onClick={remove} loading={pending === "remove"} disabled={pending !== null}>
            Hapus foto
          </Button>
        )}
      </div>
      {pending === "upload" && <p className="text-small">Mengunggah…</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

/** Nama profil, dan opsional nama panggilan di semua grup akun ini. */
export function NameForm({ name }: { name: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(name);
  const [applyToGroups, setApplyToGroups] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await sendJson<{ skipped: string[] }>("/api/profil", "PATCH", { displayName: value, applyToGroups });
    setPending(false);
    if (!result.ok) return setMessage({ tone: "error", text: result.error });
    const skipped = result.data.skipped;
    setMessage({
      tone: "info",
      text: skipped.length
        ? `Nama disimpan. Di ${skipped.join(", ")} nama ini sudah dipakai anggota lain, jadi namamu di sana tidak diganti.`
        : "Nama disimpan.",
    });
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="text-sub">Nama</h2>
        <Field label="Nama tampilan" htmlFor={id} hint="Dipakai sebagai nama saat kamu gabung atau membuat grup baru.">
          <input id={id} value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} required autoComplete="name" className={inputClass} />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ui">
          <input type="checkbox" checked={applyToGroups} onChange={(e) => setApplyToGroups(e.target.checked)} className="size-5 accent-ink-black" />
          Ganti juga namaku di semua grup
        </label>
        <Button type="submit" loading={pending} disabled={pending || value.trim() === ""}>
          Simpan nama
        </Button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </form>
    </Card>
  );
}

/** Ganti email: Supabase mengirim tautan konfirmasi; email baru berlaku setelah tautan dibuka. */
export function EmailForm({ email, pendingEmail }: { email: string | null; pendingEmail: string | null }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(pendingEmail);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await sendJson<{ email: string }>("/api/profil/email", "POST", { email: value });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setSentTo(result.data.email);
    setValue("");
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="text-sub">Email</h2>
        <p className="text-ui" data-testid="account-email">
          Email akun: <span className="font-medium break-all">{email ?? "—"}</span>
        </p>
        {sentTo && (
          <Notice>
            <span data-testid="pending-email">
              Menunggu konfirmasi untuk <span className="font-medium break-all">{sentTo}</span>. Buka tautan konfirmasi di email baru
              {email ? " dan di email lama" : ""} (bila dikirim). Sampai itu, kamu tetap masuk dengan email lama.
            </span>
          </Notice>
        )}
        <Field label="Email baru" htmlFor={id}>
          <input id={id} type="email" value={value} onChange={(e) => setValue(e.target.value)} required autoComplete="email" inputMode="email" className={inputClass} />
        </Field>
        <Button type="submit" variant="secondary" loading={pending} disabled={pending || value.trim() === ""}>
          Kirim tautan konfirmasi
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Card>
  );
}
