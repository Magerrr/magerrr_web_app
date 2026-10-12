"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Split view tablet/desktop (desain "Cari Mabar + Detail"): daftar sesi di kiri (20rem), detail di kanan, bila lebar
 * area konten ≥ 56rem (@4xl). Lebih sempit: satu panel (daftar ada di halaman grup). Hanya di halaman detail sesi;
 * halaman kerja (papan skor, patungan, dst.) memakai seluruh lebar.
 */
export function SessionSplit({ detailHref, list, children }: { detailHref: string; list: ReactNode; children: ReactNode }) {
  const split = usePathname() === detailHref;
  return (
    <div className="@container">
      <div className={split ? "@4xl:grid @4xl:grid-cols-[20rem_minmax(0,1fr)] @4xl:items-start" : undefined}>
        {split && (
          <aside
            key="daftar"
            aria-label="Daftar sesi"
            className="hidden border-ink-black @4xl:sticky @4xl:top-0 @4xl:block @4xl:h-dvh @4xl:overflow-y-auto @4xl:border-r"
          >
            {list}
          </aside>
        )}
        <div key="detail" className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
