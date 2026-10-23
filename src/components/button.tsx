"use client";

import { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useBusy } from "./busy";
import { buttonClass, type Size, type Variant } from "./button-class";
import { Spinner } from "./spinner";

/** `loading`: tombol nonaktif, tetap berwarna, spinner di depan label, dan memicu overlay bila lama. */
export function Button({
  variant,
  size,
  className,
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  useBusy(loading);
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Tombol kirim untuk `<form action={serverAction}>`: otomatis `loading` selama form diproses. */
export function SubmitButton(props: Omit<ComponentProps<typeof Button>, "type" | "loading">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}

/**
 * Spinner di dalam `<Link>` selama navigasi ke tujuannya belum selesai. Penanda `data-pending` membuat link yang
 * memakai kelas `PENDING_LINK` meredup dan tak menerima klik ulang. `className` = penempatan (mis. `absolute`).
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  useBusy(pending);
  return pending ? (
    <span data-pending="" className={className ?? "inline-flex shrink-0"}>
      <Spinner />
    </span>
  ) : null;
}
