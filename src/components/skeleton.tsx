import { Page, type PageWidth } from "@/components/ui";

function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-full bg-sandstone motion-safe:animate-pulse ${className}`} />;
}

/**
 * Kerangka halaman untuk `loading.tsx`: judul + beberapa kartu setinggi rata-rata, supaya pergantian ke konten asli
 * tidak melompat jauh. Pembungkusnya `Page` yang sama dengan halaman asli, jadi tinggi minimum dan lebar identik.
 */
export function PageSkeleton({ width, cards = 3 }: { width?: PageWidth; cards?: number }) {
  return (
    <Page width={width}>
      <div role="status" className="flex flex-col gap-6">
        <span className="sr-only">Memuat…</span>
        <div className="flex flex-col gap-3">
          <Bar className="h-8 w-2/3 max-w-sm" />
          <Bar className="h-4 w-1/2 max-w-xs" />
        </div>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} aria-hidden="true" className="flex h-28 flex-col justify-center gap-3 rounded-2xl bg-sandstone/60 p-5 motion-safe:animate-pulse">
            <Bar className="h-4 w-1/3 bg-pure-white/70" />
            <Bar className="h-4 w-2/3 bg-pure-white/70" />
          </div>
        ))}
      </div>
    </Page>
  );
}
