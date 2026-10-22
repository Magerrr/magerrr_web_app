/**
 * API create/regenerate mengembalikan `shareUrl` ke `/s/<token>` (halaman bagikan sesi), sedangkan tamu bergabung lewat
 * `/instan/<token>` (Mabar Instan 5/6). Tautan yang dibagikan host harus yang kedua.
 */
export function joinUrlFromShareUrl(shareUrl: string): string {
  const url = new URL(shareUrl);
  const token = url.pathname.split("/").filter(Boolean).pop() ?? "";
  return `${url.origin}/instan/${token}`;
}
