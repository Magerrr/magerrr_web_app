import { ImageResponse } from "next/og";
import { loadRecap, recapAccess } from "@/lib/db/recap";
import { formatDateId } from "@/lib/format";
import { cardData } from "@/lib/recap-view";
import { CARD_SIZES, RecapCard, type CardFormat } from "../../card";

const notFound = () => Response.json({ error: "Recap tidak ditemukan." }, { status: 404 });

/** Kartu recap PNG 1080×1920 (9x16) atau 1080×1080 (1x1) — PRD R4, juga gambar OpenGraph. */
export async function GET(request: Request, { params }: RouteContext<"/s/[token]/recap/kartu/[format]">) {
  const { token, format } = await params;
  if (!(format in CARD_SIZES)) return notFound();
  const access = await recapAccess(token);
  if (!access || access.session.status !== "finished") return notFound();
  const { session, group } = access;
  const { recap, names } = await loadRecap(group, session);
  const data = cardData(recap, names, {
    groupName: group.name,
    subtitle: `${formatDateId(session.startsAt)}${session.venue ? ` · ${session.venue}` : ""}`,
  });
  const download = new URL(request.url).searchParams.has("unduh");
  return new ImageResponse(<RecapCard data={data} format={format as CardFormat} />, {
    ...CARD_SIZES[format as CardFormat],
    headers: {
      // Recap bisa dimatikan / data bisa diedit: jangan di-cache lama.
      "cache-control": "private, max-age=60",
      ...(download ? { "content-disposition": `attachment; filename="recap-${session.startsAt.toISOString().slice(0, 10)}-${format}.png"` } : {}),
    },
  });
}
