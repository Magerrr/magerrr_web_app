/** Lingkaran berputar penanda proses. Mengikuti warna teks (currentColor). */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}
