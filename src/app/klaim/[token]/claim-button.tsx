"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

export function ClaimButton({ token, name }: { token: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function claim() {
    setPending(true);
    setError(null);
    const result = await sendJson<{ groupId: string }>(`/api/claim/${token}`, "POST");
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push(`/g/${result.data.groupId}`);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" onClick={claim} loading={pending}>
        {pending ? "Menghubungkan…" : `Klaim profil ${name}`}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
