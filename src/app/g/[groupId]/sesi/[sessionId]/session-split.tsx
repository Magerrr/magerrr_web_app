"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, useSyncExternalStore, type ReactNode } from "react";

/** Lebar minimum area konten untuk dua panel: 56rem = 896px (`@4xl`). */
const SPLIT_MIN_PX = 896;

/**
 * Split view tablet/desktop (desain "Cari Mabar + Detail"): daftar sesi di kiri (20rem), detail di kanan, bila lebar
 * area konten ≥ 56rem (@4xl). Lebih sempit: satu panel (daftar ada di halaman grup). Hanya di halaman detail sesi;
 * halaman kerja (papan skor, patungan, dst.) memakai seluruh lebar.
 *
 * Kolom daftar selalu dipesan lewat CSS (tanpa lonjakan tata letak), tetapi ISI daftar baru dirender di klien setelah
 * lebar terukur ≥ 56rem. Dengan begitu panel sempit tidak membawa teks ganda (status, tempat) yang tersembunyi di DOM.
 */
export function SessionSplit({ detailHref, list, children }: { detailHref: string; list: ReactNode; children: ReactNode }) {
  const split = usePathname() === detailHref;
  const box = useRef<HTMLDivElement>(null);
  const subscribe = useCallback((notify: () => void) => {
    const el = box.current;
    if (!el) return () => {};
    const observer = new ResizeObserver(notify);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const wide = useSyncExternalStore(
    subscribe,
    () => (box.current?.offsetWidth ?? 0) >= SPLIT_MIN_PX,
    () => false,
  );

  return (
    <div className="@container" ref={box}>
      <div className={split ? "@4xl:grid @4xl:grid-cols-[20rem_minmax(0,1fr)] @4xl:items-start" : undefined}>
        {split && (
          <aside
            key="daftar"
            aria-label="Daftar sesi"
            className="hidden border-ink-black @4xl:sticky @4xl:top-0 @4xl:block @4xl:h-dvh @4xl:overflow-y-auto @4xl:border-r"
          >
            {wide && list}
          </aside>
        )}
        <div key="detail" className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
