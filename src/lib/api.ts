import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/http-error";

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/**
 * Bungkus route handler: tolak permintaan tulis lintas origin, lalu petakan error ke JSON
 * `{ error }` dengan status yang sesuai. Error tak terduga → 500 tanpa detail.
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      // Pelanggaran aturan dari fungsi inti (skor mustahil, match belum selesai, …); pesan sudah untuk pengguna.
      if (error instanceof RangeError) {
        return Response.json({ error: error.message }, { status: 422 });
      }
      if (error instanceof z.ZodError) {
        const issue = error.issues[0];
        return Response.json(
          { error: issue?.message ?? "Data tidak valid.", path: issue?.path ?? [] },
          { status: 400 },
        );
      }
      console.error(error);
      return Response.json({ error: "Terjadi kesalahan di server. Coba lagi." }, { status: 500 });
    }
  };
}

/** Perangkat selalu mengirim Origin pada POST/PATCH/DELETE; klien non-Perangkat tidak membawa cookie korban. */
function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // origin tidak valid → tolak di bawah
  }
  if (!host || originHost !== host) throw new HttpError(403, "Permintaan lintas situs ditolak.");
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Kirim data sebagai JSON.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "JSON tidak valid.");
  }
  return schema.parse(body);
}
