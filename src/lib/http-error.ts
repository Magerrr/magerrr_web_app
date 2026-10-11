/** Error yang dipetakan langsung ke status HTTP oleh route handler. Pesan tampil ke pengguna. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 415 | 422 | 429,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
