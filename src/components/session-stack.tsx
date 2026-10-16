"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Icon } from "./icons";

/** Geser horizontal (px) sebelum kartu berganti; di bawahnya tetap tap biasa. */
const SWIPE_PX = 60;
/** Kartu di belakang yang masih mengintip. */
const PEEK = 2;

/**
 * Tumpukan kartu sesi di beranda (MAGERRR-15): kartu teratas utuh, dua kartu berikutnya mengintip di bawahnya.
 * Ganti kartu dengan geser kiri/kanan (Pointer Events, jalan di sentuh & mouse) atau tombol sebelumnya/berikutnya.
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
    <div className="flex flex-col gap-3" role="group" aria-roledescription="tumpukan kartu" aria-label={label}>
      <div
        className="grid touch-pan-y select-none"
        style={{ paddingBottom: Math.min(count - 1, PEEK) * 12 }}
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
              className="col-start-1 row-start-1 motion-safe:transition-[transform,opacity] motion-safe:duration-300"
              style={{
                zIndex: count - depth,
                opacity: hidden ? 0 : 1,
                transformOrigin: "top center",
                transform: isTop
                  ? `translateX(${dx}px) rotate(${dx / 40}deg)`
                  : `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`,
                transition: isTop && dx !== 0 ? "none" : undefined,
                filter: isTop ? undefined : `brightness(${1 - depth * 0.15})`,
              }}
            >
              {card}
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Sesi sebelumnya"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-ink-black bg-pure-white hover:bg-fresh-grass"
          >
            <Icon name="back" size={18} />
          </button>
          <p className="text-small" aria-live="polite" data-testid="stack-position">
            {top + 1} dari {count}
          </p>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Sesi berikutnya"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-ink-black bg-pure-white hover:bg-fresh-grass"
          >
            <Icon name="chevron" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
