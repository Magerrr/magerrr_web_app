"use client";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui";

/** Tautan gabung + tombol salin & bagikan (share sheet bila ada, mis. ke WhatsApp). */
export function ShareLink({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Tautan disalin.");
    } catch {
      toast.error(`Tidak bisa menyalin otomatis. Salin manual: ${url}`);
    }
  }
  async function share() {
    try {
      await navigator.share({ title: "Ikut mabar badminton", text: "Ikut mabar, isi nama saja tanpa akun:", url });
    } catch {
      // Dibatalkan pengguna / tidak didukung: tidak ada yang perlu dilakukan.
    }
  }
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="flex flex-col gap-3">
      <input
        readOnly
        value={url}
        aria-label="Tautan gabung"
        onFocus={(e) => e.currentTarget.select()}
        className="h-13 w-full rounded-lg border border-ink-black bg-pure-white px-4 text-small text-ink-black"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy}>Salin tautan</Button>
        {canShare && (
          <Button variant="outline" onClick={share}>
            Bagikan
          </Button>
        )}
      </div>
    </div>
  );
}
