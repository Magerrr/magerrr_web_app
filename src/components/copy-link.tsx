"use client";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui";

/** Tombol salin tautan (mis. papan skor langsung untuk grup WhatsApp). */
export function CopyLink({ url, label, done }: { url: string; label: string; done: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast(done);
    } catch {
      toast.error(`Tidak bisa menyalin otomatis. Salin manual: ${url}`);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={copy} className="self-start">
        {label}
      </Button>
    </div>
  );
}
