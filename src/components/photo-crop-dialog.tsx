"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MAX_CROP_ZOOM, clampCrop, cropRect, cropSquareImage, type SquareCrop } from "@/lib/image-resize";
import { Button } from "./button";

const OUTPUT_PX = 512;
const KEY_STEP_PX = 12;

/**
 * Langkah potong manual sebelum foto disimpan: bingkai persegi 1:1 tetap, gambar digeser (seret) dan diperbesar
 * (penggeser, cubit dua jari, roda tetikus, atau tombol panah/+/−). Panduan bulat menunjukkan tampilan avatar.
 * `src` = object URL dari `file` (dibuat & dicabut pemanggil).
 */
export function PhotoCropDialog({
  file,
  src,
  title,
  onCancel,
  onConfirm,
  onError,
}: {
  file: File;
  src: string;
  title: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  onError: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<SquareCrop | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const rect = size && crop ? cropRect(size.w, size.h, crop) : null;

  function update(next: (c: SquareCrop) => SquareCrop) {
    if (!size) return;
    setCrop((c) => (c ? clampCrop(size.w, size.h, next(c)) : c));
  }

  /** Geser gambar sejauh (dx, dy) piksel layar: titik pusat potongan bergerak berlawanan arah. */
  function pan(dx: number, dy: number) {
    const box = viewport.current?.clientWidth;
    if (!size || !box) return;
    update((c) => {
      const perPx = Math.min(size.w, size.h) / c.zoom / box;
      return { ...c, cx: c.cx - dx * perPx, cy: c.cy - dy * perPx };
    });
  }

  const zoomBy = (factor: number) => update((c) => ({ ...c, zoom: c.zoom * factor }));

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const map = pointers.current;
    const prev = map.get(event.pointerId);
    if (!prev) return;
    const next = { x: event.clientX, y: event.clientY };
    if (map.size === 1) {
      pan(next.x - prev.x, next.y - prev.y);
    } else if (map.size === 2) {
      // Cubit: perbesaran mengikuti perubahan jarak dua jari.
      const other = [...map.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(next.x - other.x, next.y - other.y);
        if (before > 0) zoomBy(after / before);
      }
    }
    map.set(event.pointerId, next);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP_PX, 0],
      ArrowRight: [-KEY_STEP_PX, 0],
      ArrowUp: [0, KEY_STEP_PX],
      ArrowDown: [0, -KEY_STEP_PX],
    };
    if (moves[event.key]) pan(...moves[event.key]);
    else if (event.key === "+" || event.key === "=") zoomBy(1.1);
    else if (event.key === "-") zoomBy(1 / 1.1);
    else return;
    event.preventDefault();
  }

  async function confirm() {
    if (!size || !rect) return;
    setSaving(true);
    try {
      onConfirm(await cropSquareImage(file, rect, { sourceWidth: size.w, max: OUTPUT_PX }));
    } catch {
      onError("Foto tidak bisa diproses. Coba foto lain.");
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-ink-black bg-pure-white p-5 text-ink-black backdrop:bg-ink-black/50"
      data-testid="photo-crop"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="crop-title" className="text-sub">
            {title}
          </h2>
          <p className="text-small">Seret untuk menggeser, perbesar untuk memotong. Hasilnya persegi 1:1.</p>
        </div>

        <div
          ref={viewport}
          role="img"
          tabIndex={0}
          aria-label="Area potong foto. Seret atau pakai tombol panah untuk menggeser, tombol plus dan minus untuk memperbesar."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onWheel={(e) => zoomBy(Math.exp(-e.deltaY * 0.002))}
          onKeyDown={onKeyDown}
          className="relative aspect-square w-full cursor-grab touch-none overflow-hidden rounded-xl bg-sandstone select-none active:cursor-grabbing"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL lokal, posisi diatur manual */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              setSize({ w, h });
              setCrop({ cx: w / 2, cy: h / 2, zoom: 1 });
            }}
            onError={() => onError("Foto tidak bisa dibaca. Pilih foto JPG, PNG, atau WebP.")}
            className="pointer-events-none absolute max-w-none"
            style={
              size && rect
                ? { width: `${(size.w / rect.side) * 100}%`, left: `${(-rect.x / rect.side) * 100}%`, top: `${(-rect.y / rect.side) * 100}%` }
                : { visibility: "hidden" }
            }
          />
          {/* Panduan avatar bulat; area di luar lingkaran tetap ikut tersimpan (persegi). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[50%] border border-pure-white shadow-[0_0_0_9999px_color-mix(in_srgb,var(--color-ink-black)_40%,transparent)]"
          />
        </div>

        <label className="flex items-center gap-3 text-small">
          Perbesar
          <input
            type="range"
            min={1}
            max={MAX_CROP_ZOOM}
            step={0.01}
            value={crop?.zoom ?? 1}
            disabled={!crop}
            onChange={(e) => update((c) => ({ ...c, zoom: Number(e.target.value) }))}
            className="min-h-11 flex-1 accent-ink-black"
          />
        </label>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
          <Button className="flex-1" onClick={confirm} loading={saving} disabled={!crop || saving}>
            Simpan foto
          </Button>
        </div>
      </div>
    </dialog>
  );
}
