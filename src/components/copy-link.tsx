"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/ui";

/** Tombol salin tautan (mis. papan skor langsung untuk grup WhatsApp). */
export function CopyLink({ url, label, done }: { url: string; label: string; done: string }) {
  const [message, setMessage] = useState<string | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(done);
    } catch {
      setMessage(`Salin manual: ${url}`);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={copy} className="self-start">
        {label}
      </Button>
      {message && <Notice>{message}</Notice>}
    </div>
  );
}
