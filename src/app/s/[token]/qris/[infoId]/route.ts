import { route } from "@/lib/api";
import { loadBill } from "@/lib/db/bill";
import { qrisResponse, readQris } from "@/lib/db/payments";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { isUuid } from "@/lib/validation";

/** Gambar QRIS penerima transfer di tagihan publik sesi ini. */
export const GET = route<RouteContext<"/s/[token]/qris/[infoId]">>(async (_request, { params }) => {
  const { token, infoId } = await params;
  const session = await findSessionByShareToken(token);
  if (!session || !isUuid(infoId)) return qrisResponse(null);
  const bill = await loadBill(session);
  return qrisResponse(await readQris(infoId, [...new Set(bill.settlements.map((s) => s.to))]));
});
