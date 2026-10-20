// Perkecil foto di peramban sebelum diunggah (logo, sampul, momen grup): hemat kuota data & Storage.
// Foto HP bisa 5–12 MB; hasil kanvas JPEG/WebP ±100–500 KB. Bila peramban tidak mendukung, berkas asli dikirim
// (server tetap memeriksa ukuran & jenis).

export interface ResizeOptions {
  /** sisi terpanjang maksimal (px) */
  max: number;
  /** potong tengah menjadi persegi (logo) */
  square?: boolean;
  /** "photo" → JPEG (foto, tanpa transparansi); "logo" → WebP/PNG agar transparansi tetap */
  kind: "photo" | "logo";
}

/** Ukuran sumber & tujuan setelah dipotong/diperkecil (murni; diuji di image-resize.test.ts). */
export function fitBox(width: number, height: number, { max, square }: Pick<ResizeOptions, "max" | "square">) {
  const side = Math.min(width, height);
  const src = square
    ? { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), w: side, h: side }
    : { x: 0, y: 0, w: width, h: height };
  const scale = Math.min(1, max / Math.max(src.w, src.h));
  return { src, dst: { w: Math.max(1, Math.round(src.w * scale)), h: Math.max(1, Math.round(src.h * scale)) } };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function resizeImage(file: File, options: ResizeOptions): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // bukan gambar yang bisa dibaca peramban → biar server yang menolak
  }
  const { src, dst } = fitBox(bitmap.width, bitmap.height, options);
  const canvas = document.createElement("canvas");
  canvas.width = dst.w;
  canvas.height = dst.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, src.x, src.y, src.w, src.h, 0, 0, dst.w, dst.h);
  bitmap.close();
  // Safari lama tidak bisa menyandikan WebP dan diam-diam memberi PNG; untuk logo PNG kecil tetap wajar.
  const blob = options.kind === "photo" ? await toBlob(canvas, "image/jpeg", 0.85) : await toBlob(canvas, "image/webp", 0.9);
  return blob && blob.size < file.size ? blob : file;
}

/** Potongan persegi manual: titik pusat (px gambar) + perbesaran; zoom 1 = sisi terpendek gambar penuh. */
export interface SquareCrop {
  cx: number;
  cy: number;
  zoom: number;
}

export const MAX_CROP_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Kotak sumber persegi untuk `crop`, selalu di dalam gambar (murni; diuji di image-resize.test.ts). */
export function cropRect(width: number, height: number, { cx, cy, zoom }: SquareCrop) {
  const side = Math.min(width, height) / clamp(zoom, 1, MAX_CROP_ZOOM);
  return { x: clamp(cx - side / 2, 0, width - side), y: clamp(cy - side / 2, 0, height - side), side };
}

/** Rapikan `crop` agar potongan tidak keluar gambar; geseran melewati tepi tidak menumpuk. */
export function clampCrop(width: number, height: number, crop: SquareCrop): SquareCrop {
  const { x, y, side } = cropRect(width, height, crop);
  return { cx: x + side / 2, cy: y + side / 2, zoom: clamp(crop.zoom, 1, MAX_CROP_ZOOM) };
}

/**
 * Potong `file` sesuai kotak `rect` (dalam ukuran gambar `sourceWidth` px yang dilihat pengguna) lalu perkecil ke
 * maksimal `max` px persegi, JPEG. Latar putih agar PNG transparan tidak jadi hitam.
 */
export async function cropSquareImage(
  file: File,
  rect: { x: number; y: number; side: number },
  { sourceWidth, max }: { sourceWidth: number; max: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = bitmap.width / sourceWidth;
  const size = Math.max(1, Math.round(Math.min(max, rect.side * scale)));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kanvas tidak tersedia.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, rect.x * scale, rect.y * scale, rect.side * scale, rect.side * scale, 0, 0, size, size);
  bitmap.close();
  const blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (!blob) throw new Error("Foto tidak bisa diproses.");
  return blob;
}
