"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Field, inputBase, inputClass } from "@/components/ui";
import { useNavigate } from "@/components/use-navigate";
import { sendJson } from "@/lib/api-client";

export function CreateGroupForm() {
  const { navigate, pending: navigating } = useNavigate();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const result = await sendJson<{ id: string }>("/api/groups", "POST", {
      name: String(form.get("name") ?? ""),
      emoji: String(form.get("emoji") ?? ""),
    });
    if (result.ok) {
      toast("Grup dibuat.");
      navigate(`/g/${result.data.id}`);
    } else {
      toast.error(result.error);
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
      <Button type="submit" size="lg" loading={pending || navigating}>
        {pending || navigating ? "Membuat…" : "Buat grup"}
      </Button>
    </form>
  );
}
