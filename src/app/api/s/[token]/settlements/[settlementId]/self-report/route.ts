import { route } from "@/lib/api";
import { getMembership } from "@/lib/db/authz";
import { setPaymentStatus } from "@/lib/db/bill";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { HttpError } from "@/lib/http-error";
import { isUuid } from "@/lib/validation";

/**
 * "Saya sudah bayar" dari halaman tagihan publik (tanpa login). Hanya menandai menunggu konfirmasi;
 * lunas tetap ditentukan admin. Pelaku dicatat bila pengunjung dikenali sebagai anggota grup.
 */
export const POST = route<RouteContext<"/api/s/[token]/settlements/[settlementId]/self-report">>(async (_request, { params }) => {
  const { token, settlementId } = await params;
  const session = await findSessionByShareToken(token);
  if (!session || !isUuid(settlementId)) throw new HttpError(404, "Tagihan tidak ditemukan.");
  const membership = await getMembership(session.groupId);
  await setPaymentStatus(session.id, membership?.member.id ?? null, settlementId, "self_report", new Date());
  return Response.json({ ok: true });
});
