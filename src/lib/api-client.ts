// Pemanggil route handler dari komponen klien. Pesan error dari server sudah berbahasa Indonesia.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function sendJson<T>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: unknown = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.error ?? "Terjadi kesalahan. Coba lagi." };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "Tidak ada koneksi. Periksa internet lalu coba lagi." };
  }
}
