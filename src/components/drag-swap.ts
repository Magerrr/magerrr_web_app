"use client";

import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";

/** Jarak (px) sebelum tekan dianggap seret; di bawahnya tetap klik/tap biasa. */
const DRAG_THRESHOLD = 6;
const DROP_ATTR = "data-drop-key";

interface Active {
  key: string;
  dx: number;
  dy: number;
  over: string | null;
}

/** Target di bawah pointer, melewati item yang sedang diseret beserta isinya (mis. chip di kartu lapangan yang diseret). */
function dropKeyAt(x: number, y: number, dragging: string): string | null {
  const root = document.querySelector(`[${DROP_ATTR}="${CSS.escape(dragging)}"]`);
  for (const el of document.elementsFromPoint(x, y)) {
    if (root?.contains(el)) continue;
    const key = el.closest(`[${DROP_ATTR}]`)?.getAttribute(DROP_ATTR);
    if (key && key !== dragging) return key;
  }
  return null;
}

/**
 * Seret-lepas untuk menukar/memindah item, berbasis Pointer Events agar jalan di mouse dan layar sentuh
 * (HTML5 drag-and-drop tidak jalan di sentuh). Item diseret lewat `handle(key)`; target ditandai `drop(key)`.
 * Kunci boleh berawalan namespace (mis. `p:` pemain, `c:` lapangan); `onDrop` memutuskan pasangan yang sah.
 * Seret tidak memicu klik, sehingga tap-untuk-tukar tetap bisa dipakai sebagai alternatif aksesibel.
 */
export function useDragSwap(onDrop: (from: string, to: string) => void) {
  const [active, setActive] = useState<Active | null>(null);
  const start = useRef<{ key: string; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  const reset = () => {
    start.current = null;
    setActive(null);
  };

  const handle = (key: string) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      start.current = { key, x: e.clientX, y: e.clientY, dragging: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s || s.key !== key) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      s.dragging = true;
      setActive({ key, dx, dy, over: dropKeyAt(e.clientX, e.clientY, key) });
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      if (s?.key === key && s.dragging) {
        suppressClick.current = true;
        const over = dropKeyAt(e.clientX, e.clientY, key);
        if (over) onDrop(key, over);
      }
      reset();
    },
    onPointerCancel: reset,
    onClickCapture(e: MouseEvent<HTMLElement>) {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    "data-dragging": active?.key === key ? "" : undefined,
  });

  /** Gaya untuk elemen yang ikut bergerak saat `key` diseret (bisa elemen lain dari pegangannya). */
  const dragStyle = (key: string): CSSProperties | undefined =>
    active?.key === key ? { transform: `translate(${active.dx}px, ${active.dy}px)`, zIndex: 20, position: "relative" } : undefined;

  const drop = (key: string) => ({ [DROP_ATTR]: key });
  const isOver = (key: string) => active !== null && active.over === key;

  return { handle, drop, dragStyle, isOver, dragging: active?.key ?? null };
}
