"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

/** Geser horizontal (px) sebelum kartu berganti; di bawahnya tetap tap biasa. */
const SWIPE_PX = 60;
/** Kartu di belakang yang masih mengintip. */
const PEEK = 2;
/** Selisih vertikal (px) antar kartu di tumpukan: tinggi tepi kartu belakang yang terlihat. */
const STEP = 8;

/**
 * Tumpukan kartu sesi di beranda (MAGERRR-15): kartu teratas utuh, dua kartu berikutnya mengintip di bawahnya.
 * Ganti kartu dengan geser kiri/kanan (Pointer Events, jalan di sentuh & mouse) atau panah kiri/kanan saat tumpukan
 * difokus; tanpa tombol navigasi.
 * Kartu di belakang `inert` (tidak bisa difokus/dibaca) sampai jadi kartu teratas.
 */
export function SessionStack({ cards, label = "Sesi terdekat" }: { cards: ReactNode[]; label?: string }) {
  const [top, setTop] = useState(0);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
  const count = cards.length;
  if (count === 0) return null;

  const go = (step: number) => setTop((i) => (i + step + count) % count);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (count < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiped.current = false;
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x;
    const y = e.clientY - s.y;
    if (!swiped.current) {
      if (Math.max(Math.abs(x), Math.abs(y)) < 8) return;
      // Gerak vertikal = gulir halaman, bukan geser kartu.
      if (Math.abs(y) > Math.abs(x)) {
        start.current = null;
        return;
      }
      swiped.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (swiped.current) setDx(x);
  }
  function up() {
    if (!start.current) return;
    start.current = null;
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
    setDx(0);
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl"
      role="group"
      aria-roledescription="tumpukan kartu"
      aria-label={count > 1 ? `${label}. Geser kartu, atau tekan panah kiri/kanan, untuk ganti sesi.` : label}
      // Pengganti tombol navigasi untuk keyboard: fokus tumpukan lalu panah kiri/kanan.
      tabIndex={count > 1 ? 0 : undefined}
      onKeyDown={(e) => {
        if (count < 2 || e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          go(e.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      <div
        className="grid touch-pan-y select-none"
        style={{ paddingBottom: Math.min(count - 1, PEEK) * STEP }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        // Setelah geser, jangan anggap sebagai tap pada tautan "Detail".
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
          }
        }}
        data-testid="session-stack"
      >
        {cards.map((card, i) => {
          const depth = (i - top + count) % count;
          const hidden = depth > PEEK;
          const isTop = depth === 0;
          return (
            <div
              key={i}
              inert={!isTop}
              aria-hidden={!isTop}
              data-depth={depth}
              // Garis cream-paper memisahkan tepi kartu dari kartu gelap di belakangnya (MAGERRR-23).
              className="col-start-1 row-start-1 rounded-2xl ring-1 ring-cream-paper motion-safe:transition-[transform,opacity] motion-safe:duration-300"
              style={{
                zIndex: count - depth,
                opacity: hidden ? 0 : 1,
                // Skala dari tepi bawah: tepi bawah kartu belakang turun tepat STEP px, jadi selalu terlihat di bawah kartu depan.
                transformOrigin: "bottom center",
                transform: isTop
                  ? `translateX(${dx}px) rotate(${dx / 40}deg)`
                  : `translateY(${depth * STEP}px) scale(${1 - depth * 0.04})`,
                transition: isTop && dx !== 0 ? "none" : undefined,
                filter: isTop ? undefined : `brightness(${1 - depth * 0.08})`,
              }}
            >
              {card}
            </div>
          );
        })}
      </div>
      {/* Tanpa tombol navigasi (permintaan pengguna): titik hanya penanda jumlah & posisi; pembaca layar memakai teks di bawahnya. */}
      {count > 1 && (
        <>
          <div className="flex justify-center gap-1.5" aria-hidden="true" data-testid="stack-dots">
            {cards.map((_, i) => (
              <span
                key={i}
                data-active={i === top}
                className={`h-2 rounded-full bg-ink-black motion-safe:transition-[width,opacity] ${i === top ? "w-5" : "w-2 opacity-30"}`}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite" data-testid="stack-position">
            Sesi {top + 1} dari {count}
          </p>
        </>
      )}
    </div>
  );
}
