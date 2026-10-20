"use client";

import { useActionState, useEffect } from "react";
import { toast } from "@/components/toast";
import { Button, Field, inputClass } from "@/components/ui";
import { sendMagicLink, type EmailState } from "./actions";

export function EmailForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<EmailState, FormData>(sendMagicLink, { status: "idle" });
  useEffect(() => {
    if (state.status === "sent") toast(`Tautan masuk sudah dikirim ke ${state.email}. Buka email itu di perangkat ini.`);
    if (state.status === "error") toast.error(state.message);
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email" hint="Kami kirim tautan masuk ke email ini. Tanpa kata sandi.">
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className={inputClass} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Mengirim…" : state.status === "sent" ? "Kirim ulang tautan" : "Kirim tautan masuk"}
      </Button>
    </form>
  );
}
