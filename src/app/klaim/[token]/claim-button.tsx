"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

export function ClaimButton({ token, name }: { token: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function claim() {
    setPending(true);
    const result = await sendJson<{ groupId: string }>(`/api/claim/${token}`, "POST");
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast(`Profil ${name} sekarang terhubung ke akunmu.`);
    router.push(`/g/${result.data.groupId}`);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" onClick={claim} loading={pending}>
        {pending ? "Menghubungkan…" : `Klaim profil ${name}`}
      </Button>
    </div>
  );
}
