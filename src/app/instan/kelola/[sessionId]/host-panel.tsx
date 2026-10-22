"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Card, Notice } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import { joinUrlFromShareUrl } from "../../link";
import { ShareLink } from "../../share-link";

type Action = "regen" | "cancel";

export function HostPanel({
  groupId,
  sessionId,
  joinUrl,
  names,
  finished,
}: {
  groupId: string;
  sessionId: string;
  joinUrl: string;
  names: string[];
  finished: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(joinUrl);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);

  async function regenerate() {
    setBusy("regen");
    const result = await sendJson<{ shareUrl: string }>(`/api/sessions/${sessionId}/instant/regenerate`, "POST");
    setBusy(null);
    setConfirming(null);
    if (result.ok) {
      setUrl(joinUrlFromShareUrl(result.data.shareUrl));
      toast("Tautan baru dibuat. Tautan lama tidak berlaku.");
    } else {
      toast.error(result.error);
    }
  }

  async function cancel() {
    setBusy("cancel");
    const result = await sendJson<null>(`/api/groups/${groupId}/sessions/${sessionId}`, "DELETE");
    if (result.ok) {
      toast("Sesi dibatalkan.");
      router.push("/");
      router.refresh();
    } else {
      toast.error(result.error);
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <h2 className="text-sub">Tautan gabung</h2>
        <ShareLink url={url} />
        {confirming === "regen" ? (
          <Notice tone="error">
            <p>Tautan lama langsung berhenti berlaku. Peserta yang sudah ikut tetap tercatat.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={regenerate} loading={busy === "regen"}>
                Ya, buat tautan baru
              </Button>
              <Button variant="outline" onClick={() => setConfirming(null)} disabled={busy !== null}>
                Batal
              </Button>
            </div>
          </Notice>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setConfirming("regen")} disabled={busy !== null}>
            Buat tautan baru
          </Button>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sub">Peserta ({names.length})</h2>
        {names.length === 0 ? (
          <p className="text-ui">Belum ada yang ikut.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="peserta">
            {names.map((name) => (
              <li key={name} className="text-ui">
                {name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!finished &&
        (confirming === "cancel" ? (
          <Notice tone="error">
            <p>Sesi beserta datanya dihapus dan tautan berhenti berlaku. Tindakan ini tidak bisa dibatalkan.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={cancel} loading={busy === "cancel"}>
                Ya, batalkan sesi
              </Button>
              <Button variant="outline" onClick={() => setConfirming(null)} disabled={busy !== null}>
                Kembali
              </Button>
            </div>
          </Notice>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setConfirming("cancel")} disabled={busy !== null}>
            Batalkan sesi
          </Button>
        ))}
    </div>
  );
}
