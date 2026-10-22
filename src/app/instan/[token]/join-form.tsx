"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, Notice, inputClass } from "@/components/ui";

/** Form "Isi nama & Join" untuk tamu. Sukses → ke halaman sesi grup (cookie tamu sudah diset server). */
export function JoinForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fail(message: string) {
    setError(message);
    toast.error(message);
    setPending(false);
  }

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/instant/${token}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: String(form.get("display_name") ?? "") }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast("Kamu sudah ikut.");
        router.push(`/g/${data.groupId}/sesi/${data.sessionId}`);
        router.refresh();
        return;
      }
      fail(data.error ?? "Terjadi kesalahan. Coba lagi.");
    } catch {
      fail("Tidak ada koneksi. Periksa internet lalu coba lagi.");
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field label="Nama panggilan" htmlFor="display_name" hint="Tanpa akun. Perangkat ini akan mengingatmu selama setahun.">
        <input
          id="display_name"
          name="display_name"
          required
          maxLength={40}
          autoComplete="nickname"
          className={inputClass}
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Mendaftar…" : "Isi nama & Join"}
      </Button>
    </form>
  );
}
