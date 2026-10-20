"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBusy } from "@/components/busy";
import { toast } from "@/components/toast";
import { Spinner, textButtonClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

export function VoidButton({ url }: { url: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  useBusy(pending);
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={async () => {
        if (!window.confirm("Batalkan match ini? Match tidak dihitung di klasemen.")) return;
        setPending(true);
        const result = await sendJson(url, "POST");
        setPending(false);
        if (!result.ok) return toast.error(result.error);
        toast("Match dibatalkan.");
        router.refresh();
      }}
      className={textButtonClass}
    >
      {pending && <Spinner />}
      Batalkan
    </button>
  );
}
