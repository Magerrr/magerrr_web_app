"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

/** `url`: `/api/join/<kode undangan>` atau `/api/groups/<id>/join` (grup publik). */
export function JoinForm({ url, defaultName, withAccount }: { url: string; defaultName: string; withAccount: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const result = await sendJson<{ groupId: string }>(url, "POST", {
      displayName: String(form.get("displayName") ?? ""),
    });
    if (result.ok) {
      toast("Berhasil gabung grup.");
      router.push(`/g/${result.data.groupId}`);
      router.refresh();
    } else {
      toast.error(result.error);
      setPending(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
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
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Bergabung…" : "Gabung grup"}
      </Button>
    </form>
  );
}
