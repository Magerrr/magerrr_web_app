"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "@/components/toast";
import { Button, Card } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { resizeImage } from "@/lib/image-resize";

type Kind = "logo" | "cover";

const COPY: Record<Kind, { title: string; hint: string; resize: Parameters<typeof resizeImage>[1] }> = {
  logo: { title: "Logo", hint: "Dipotong persegi, tampil bulat di beranda & daftar grup.", resize: { max: 512, square: true, kind: "logo" } },
  cover: { title: "Gambar sampul", hint: "Tampil lebar di atas beranda grup (rasio 3:1).", resize: { max: 1600, kind: "photo" } },
};

/** Unggah / ganti / hapus logo & gambar sampul grup (MAGERRR-8). Foto diperkecil di peramban dulu. */
export function GroupImages({ groupId, logoUrl, coverUrl }: { groupId: string; logoUrl: string | null; coverUrl: string | null }) {
  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-sub">Logo & sampul</h2>
      <ImageField groupId={groupId} kind="logo" url={logoUrl} />
      <ImageField groupId={groupId} kind="cover" url={coverUrl} />
    </Card>
  );
}

function ImageField({ groupId, kind, url }: { groupId: string; kind: Kind; url: string | null }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  const copy = COPY[kind];
  const endpoint = `/api/groups/${groupId}/media/${kind}`;

  async function upload(file: File) {
    setPending("upload");
    const form = new FormData();
    form.set("file", await resizeImage(file, copy.resize), file.name);
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      if (!response.ok) toast.error((await response.json().catch(() => ({}))).error ?? "Gagal mengunggah. Coba lagi.");
      else {
        toast(`${copy.title} grup diperbarui.`);
        router.refresh();
      }
    } catch {
      toast.error("Tidak ada koneksi. Periksa internet lalu coba lagi.");
    }
    setPending(null);
    if (input.current) input.current.value = "";
  }

  async function remove() {
    setPending("remove");
    const result = await sendJson(endpoint, "DELETE");
    setPending(null);
    if (!result.ok) return toast.error(result.error);
    toast(`${copy.title} grup dihapus.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`group-${kind}`}>
      <label htmlFor={id} className="text-ui font-medium">
        {copy.title}
      </label>
      <p className="text-small">{copy.hint}</p>
      {url && (
        <div className={`relative overflow-hidden border border-ink-black bg-sandstone ${kind === "logo" ? "size-20 rounded-full" : "aspect-[3/1] w-full rounded-2xl"}`}>
          <Image src={url} alt={`${copy.title} grup saat ini`} fill sizes={kind === "logo" ? "80px" : "(min-width: 640px) 576px, 100vw"} unoptimized className="object-cover" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={pending !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          className="min-h-11 max-w-full text-ui file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-ink-black file:bg-fresh-grass/25 file:px-4 file:text-ui"
        />
        {url && (
          <Button variant="secondary" onClick={remove} loading={pending === "remove"} disabled={pending !== null}>
            Hapus {copy.title.toLowerCase()}
          </Button>
        )}
      </div>
      {pending === "upload" && <p className="text-small">Mengunggah…</p>}
    </div>
  );
}
