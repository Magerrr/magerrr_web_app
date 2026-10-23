"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * `router.push` yang dibungkus transisi: `pending` menyala sampai halaman tujuan tampil (pakai untuk `loading`
 * tombol), dan panggilan selama navigasi berjalan diabaikan agar klik ganda tidak menavigasi dua kali.
 */
export function useNavigate() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(href: string, { refresh = false }: { refresh?: boolean } = {}) {
    if (pending) return;
    startTransition(() => {
      router.push(href);
      if (refresh) router.refresh();
    });
  }
  return { navigate, pending };
}
