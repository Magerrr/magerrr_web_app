"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, Notice, inputClass } from "@/components/ui";

/** Tombol "Ikut sesi" + konfirmasi transparan. API membalas 303 ke halaman sesi; kegagalan berupa JSON `{ error }`. */
export function IkutForm({
  sessionId,
  groupName,
  defaultName,
  withAccount,
  isMember,
}: {
  sessionId: string;
  groupName: string;
  defaultName: string;
  withAccount: boolean;
  isMember: boolean;
}) {
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
      const response = await fetch(`/api/jelajah/sesi/${sessionId}/ikut`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isMember ? {} : { displayName: String(form.get("displayName") ?? "") }),
      });
      if (response.ok && response.redirected) {
        toast("Kamu ikut sesi ini.");
        router.push(new URL(response.url).pathname);
        router.refresh();
        return;
      }
      const data = await response.json().catch(() => ({}));
      fail(data.error ?? "Terjadi kesalahan. Coba lagi.");
    } catch {
      fail("Tidak ada koneksi. Periksa internet lalu coba lagi.");
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      {!isMember && (
        <>
          <p className="text-ui" data-testid="ikut-transparansi">
            Dengan ikut, kamu otomatis menjadi anggota grup {groupName}.
          </p>
          <Field
            label="Nama panggilan"
            htmlFor="displayName"
            hint={withAccount ? "Nama yang tampil di skor dan klasemen grup." : "Tanpa akun. Perangkat ini akan mengingatmu selama setahun."}
          >
            <input
              id="displayName"
              name="displayName"
              defaultValue={defaultName}
              required
              maxLength={40}
              autoComplete="nickname"
              className={inputClass}
            />
          </Field>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Mendaftar…" : "Ikut sesi ini"}
      </Button>
    </form>
  );
}
