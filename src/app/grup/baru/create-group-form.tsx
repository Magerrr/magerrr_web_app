"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Notice, inputBase, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

export function CreateGroupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const result = await sendJson<{ id: string }>("/api/groups", "POST", {
      name: String(form.get("name") ?? ""),
      emoji: String(form.get("emoji") ?? ""),
    });
    if (result.ok) {
      router.push(`/g/${result.data.id}`);
    } else {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field label="Nama grup" htmlFor="name" hint="Misalnya nama komunitas atau jadwal main rutin.">
        <input id="name" name="name" required maxLength={60} autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Ikon (opsional)" htmlFor="emoji" hint="Satu emoji sebagai ikon grup.">
        <input id="emoji" name="emoji" maxLength={16} autoComplete="off" className={`${inputBase} w-24`} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Membuat…" : "Buat grup"}
      </Button>
    </form>
  );
}
