"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

export function JoinForm({ code, defaultName, withAccount }: { code: string; defaultName: string; withAccount: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const result = await sendJson<{ groupId: string }>(`/api/join/${code}`, "POST", {
      displayName: String(form.get("displayName") ?? ""),
    });
    if (result.ok) {
      router.push(`/g/${result.data.groupId}`);
      router.refresh();
    } else {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field
        label="Nama panggilan"
        htmlFor="displayName"
        hint={withAccount ? "Nama yang tampil di skor dan klasemen grup." : "Tanpa akun. Peramban ini akan mengingatmu selama setahun."}
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
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Bergabung…" : "Gabung grup"}
      </Button>
    </form>
  );
}
