"use client";

import { useActionState } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { sendMagicLink, type EmailState } from "./actions";

export function EmailForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<EmailState, FormData>(sendMagicLink, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email" hint="Kami kirim tautan masuk ke email ini. Tanpa kata sandi.">
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className={inputClass} />
      </Field>
      {state.status === "sent" && (
        <Notice>
          Tautan masuk sudah dikirim ke <strong className="font-medium">{state.email}</strong>. Buka email itu di
          perangkat ini.
        </Notice>
      )}
      {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Mengirim…" : state.status === "sent" ? "Kirim ulang tautan" : "Kirim tautan masuk"}
      </Button>
    </form>
  );
}
