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
