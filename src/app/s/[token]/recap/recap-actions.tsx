"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, buttonClass } from "@/components/ui";
import { trackShare } from "@/lib/analytics-client";
import { sendJson } from "@/lib/api-client";

/** Unduh kartu 9:16 / 1:1 dan bagikan (Web Share API bila ada, selain itu salin tautan). */
export function ShareRecap({ cardBase, url, title, token }: { cardBase: string; url: string; title: string; token: string }) {
  const [pending, setPending] = useState(false);

  async function share() {
    setPending(true);
    try {
      if (typeof navigator.share === "function") {
        const blob = await (await fetch(`${cardBase}/9x16`)).blob();
        const file = new File([blob], "recap-magerrr.png", { type: "image/png" });
        const data: ShareData = navigator.canShare?.({ files: [file] }) ? { files: [file], title, text: `${title}\n${url}` } : { title, url };
        await navigator.share(data);
        trackShare("recap_shared", token, "web_share");
      } else {
        await navigator.clipboard.writeText(url);
        trackShare("recap_shared", token, "copy_link");
        toast("Tautan recap disalin.");
      }
    } catch (error) {
      // Pengguna menutup lembar bagikan → bukan error.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("Tidak bisa membagikan. Salin tautan di bawah secara manual.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" variant="accent" onClick={share} loading={pending}>
        Bagikan recap
      </Button>
      <div className="flex gap-2">
        <a href={`${cardBase}/9x16?unduh`} download onClick={() => trackShare("recap_shared", token, "download")} className={buttonClass("secondary", "md", "flex-1")}>
          Unduh 9:16
        </a>
        <a href={`${cardBase}/1x1?unduh`} download onClick={() => trackShare("recap_shared", token, "download")} className={buttonClass("secondary", "md", "flex-1")}>
          Unduh 1:1
        </a>
      </div>
      <p className="text-small break-all" data-testid="recap-url">
        {url}
      </p>
    </div>
  );
}

/** Admin: recap bisa dibuka tanpa login atau hanya anggota grup. */
export function RecapVisibility({ url, value }: { url: string; value: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function toggle() {
    setPending(true);
    const result = await sendJson(url, "PATCH", { public: !value });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast(value ? "Recap sekarang privat." : "Recap sekarang publik.");
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small" data-testid="recap-visibility">
        {value ? "Recap publik: siapa pun yang punya tautan bisa melihat." : "Recap privat: hanya anggota grup yang bisa melihat."}
      </p>
      <Button variant="secondary" onClick={toggle} loading={pending}>
        {value ? "Jadikan privat" : "Jadikan publik"}
      </Button>
    </div>
  );
}
