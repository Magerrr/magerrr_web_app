import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { Card, Page, TopBar } from "@/components/ui";
import { groupMetrics, type MetricSummary } from "@/lib/core/metrics";
import { getGroup } from "@/lib/db/groups";
import { loadGroupMetricInputs } from "@/lib/db/metrics";
import { formatShortDateId } from "@/lib/format";
import { pageAccess } from "../access";

export const metadata: Metadata = { title: "Metrik pemakaian" };

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
const minutes = (v: number | null) => (v === null ? "–" : v >= 60 ? `${Math.round(v / 6) / 10} jam` : `${Math.round(v)} mnt`);

function Row({ label, m }: { label: string; m: MetricSummary }) {
  return (
    <tr className="border-t border-ink-black">
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        {label}
      </th>
      <td className="py-2 pr-3 tabular-nums">{m.finishedSessions}/{m.sessions}</td>
      <td className="py-2 pr-3 tabular-nums">{pct(m.withScore)}</td>
      <td className="py-2 pr-3 tabular-nums">{pct(m.withBill)}</td>
      <td className="py-2 pr-3 tabular-nums">{pct(m.recapShared)}</td>
      <td className="py-2 pr-3 tabular-nums">{pct(m.openedLink)}</td>
      <td className="py-2 tabular-nums">{minutes(m.medianMinutesToClose)}</td>
    </tr>
  );
}

/** Metrik pemakaian grup 8 pekan terakhir (PRD §4), pekan mulai Senin WIB. Hanya admin. */
export default async function MetricsPage({ params }: PageProps<"/g/[groupId]/metrik">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "admin");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/metrik`} />;
  const now = new Date();
  const [group, inputs] = await Promise.all([getGroup(groupId), loadGroupMetricInputs(groupId, now)]);
  const { total, weeks } = groupMetrics(inputs, now);

  return (
    <Page width="wide">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Metrik pemakaian</h1>
        <p className="text-ui">
          8 pekan terakhir, per pekan (Senin–Minggu, WIB). Persentase dihitung dari sesi selesai; sesi sebelum pencatatan metrik aktif tidak punya data.
        </p>
      </div>
      <Card>
        <div className="overflow-x-auto" data-testid="metrics">
          <table className="text-small w-full min-w-[40rem]">
            <thead>
              <tr className="text-left">
                <th scope="col" className="pb-2 pr-3 font-normal">Pekan</th>
                <th scope="col" className="pb-2 pr-3 font-normal">Selesai/sesi</th>
                <th scope="col" className="pb-2 pr-3 font-normal">Ada skor</th>
                <th scope="col" className="pb-2 pr-3 font-normal">Ada patungan</th>
                <th scope="col" className="pb-2 pr-3 font-normal">Recap dibagikan</th>
                <th scope="col" className="pb-2 pr-3 font-normal">Peserta buka link</th>
                <th scope="col" className="pb-2 font-normal">Median buat→tutup</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Total" m={total} />
              {weeks.map((w) => (
                <Row key={w.weekStart.toISOString()} label={formatShortDateId(w.weekStart)} m={w} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Page>
  );
}
