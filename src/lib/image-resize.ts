// Perkecil foto di Perangkat sebelum diunggah (logo, sampul, momen grup): hemat kuota data & Storage.
// Foto HP bisa 5–12 MB; hasil kanvas JPEG/WebP ±100–500 KB. Bila Perangkat tidak mendukung, berkas asli dikirim
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
    return file; // bukan gambar yang bisa dibaca Perangkat → biar server yang menolak
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

/** Potongan manual: titik pusat (px gambar) + perbesaran; zoom 1 = kotak terbesar berrasio `aspect` yang muat di gambar. */
export interface SquareCrop {
  cx: number;
  cy: number;
  zoom: number;
}

export const MAX_CROP_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Kotak sumber berrasio `aspect` (lebar/tinggi, bawaan 1 = persegi) untuk `crop`, selalu di dalam gambar.
 * `side` = lebar kotak; tingginya `side / aspect` (murni; diuji di image-resize.test.ts).
 */
export function cropRect(width: number, height: number, { cx, cy, zoom }: SquareCrop, aspect = 1) {
  const side = Math.min(width, height * aspect) / clamp(zoom, 1, MAX_CROP_ZOOM);
  const h = side / aspect;
  return { x: clamp(cx - side / 2, 0, width - side), y: clamp(cy - h / 2, 0, height - h), side };
}

/** Rapikan `crop` agar potongan tidak keluar gambar; geseran melewati tepi tidak menumpuk. */
export function clampCrop(width: number, height: number, crop: SquareCrop, aspect = 1): SquareCrop {
  const { x, y, side } = cropRect(width, height, crop, aspect);
  return { cx: x + side / 2, cy: y + side / aspect / 2, zoom: clamp(crop.zoom, 1, MAX_CROP_ZOOM) };
}

/**
 * Potong `file` sesuai kotak `rect` (dalam ukuran gambar `sourceWidth` px yang dilihat pengguna) lalu perkecil ke
 * lebar maksimal `max` px dengan rasio `aspect`, JPEG. Latar putih agar PNG transparan tidak jadi hitam.
 */
export async function cropImage(
  file: File,
  rect: { x: number; y: number; side: number },
  { sourceWidth, max, aspect = 1 }: { sourceWidth: number; max: number; aspect?: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = bitmap.width / sourceWidth;
  const width = Math.max(1, Math.round(Math.min(max, rect.side * scale)));
  const height = Math.max(1, Math.round(width / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kanvas tidak tersedia.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, rect.x * scale, rect.y * scale, rect.side * scale, (rect.side / aspect) * scale, 0, 0, width, height);
  bitmap.close();
  const blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (!blob) throw new Error("Foto tidak bisa diproses.");
  return blob;
}
