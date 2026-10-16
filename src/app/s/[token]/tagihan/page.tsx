import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillProgressCard, PaymentInfoList, PeopleTable, TransferList } from "@/components/bill";
import { SelfReportButton } from "@/components/bill-actions";
import { Card, Page, Split } from "@/components/ui";
import { getMembership } from "@/lib/db/authz";
import { loadBillView } from "@/lib/db/bill";
import { getGroup } from "@/lib/db/groups";
import { findSessionByShareToken } from "@/lib/db/sessions";
import { formatDateId, formatRupiah, formatTimeRangeId } from "@/lib/format";

// Tautan tagihan bersifat rahasia (token); jangan diindeks mesin pencari.
export const metadata: Metadata = { title: "Tagihan patungan", robots: { index: false, follow: false } };

/** Tagihan publik (PRD P8): tanpa login; satu-satunya aksi tulis = "Saya sudah bayar". */
export default async function PublicBillPage({ params }: PageProps<"/s/[token]/tagihan">) {
  const { token } = await params;
  const session = await findSessionByShareToken(token);
  if (!session) notFound();
  const [group, membership] = await Promise.all([getGroup(session.groupId), getMembership(session.groupId)]);
  const view = await loadBillView(group, session);
  const { state, names } = view;
  const me = membership?.member.id ?? null;
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  const receivers = view.payTo.filter((p) => state.settlements.some((s) => s.to === p.memberId));
  const hasBill = state.expenses.length > 0 || (state.flatFee !== null && state.settlements.length > 0);

  return (
    <Page width={hasBill ? "wide" : "regular"}>
      <div className="flex flex-col gap-2">
        <p className="text-small">{group.name}</p>
        <h1 className="text-title">Tagihan patungan</h1>
        <p className="text-ui">
          {formatDateId(session.startsAt)} · {formatTimeRangeId(session.startsAt, session.durationMin)}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
      </div>

      {!hasBill ? (
        <Card>
          <p className="text-ui">Belum ada biaya yang dicatat untuk sesi ini.</p>
        </Card>
      ) : (
        // Desktop: siapa bayar ke siapa di kiri, rekening & rincian biaya di kanan.
        <Split
          variant="half"
          main={
            <>
              {state.settlements.length > 0 && <BillProgressCard progress={view.progress} />}

              <section aria-labelledby="transfer" className="flex flex-col gap-3">
                <h2 id="transfer" className="text-sub">
                  Siapa bayar ke siapa
                </h2>
                {state.flatFee !== null && (
                  <p className="text-ui" data-testid="flat-summary">
                    Iuran flat {formatRupiah(state.flatFee)} per orang.
                  </p>
                )}
                <p className="text-small">Cari namamu, transfer ke penerima, lalu tekan &ldquo;Saya sudah bayar&rdquo;. Host akan mengonfirmasi.</p>
                <TransferList
                  settlements={state.settlements}
                  names={names}
                  me={me}
                  actions={(s) =>
                    s.status !== "paid" && !s.selfReported && (me === null || me === s.from) ? (
                      <SelfReportButton url={`/api/s/${token}/settlements/${s.id}/self-report`} />
                    ) : null
                  }
                />
              </section>
            </>
          }
          aside={
            <>
              {receivers.length > 0 && (
                <section aria-labelledby="rekening" className="flex flex-col gap-3">
                  <h2 id="rekening" className="text-sub">
                    Transfer ke
                  </h2>
                  {receivers.map((p) => (
                    <Card key={p.memberId} className="flex flex-col gap-3">
                      <h3 className="text-lead">{names[p.memberId] ?? "?"}</h3>
                      {p.infos.length > 0 ? (
                        <PaymentInfoList infos={p.infos} qrSrc={(id) => `/s/${token}/qris/${id}`} />
                      ) : (
                        <p className="text-small">Belum ada info rekening. Tanyakan langsung ke {names[p.memberId] ?? "penerima"}.</p>
                      )}
                    </Card>
                  ))}
                </section>
              )}

              <section aria-labelledby="biaya" className="flex flex-col gap-3">
                <h2 id="biaya" className="text-sub">
                  Biaya
                </h2>
                <Card>
                  <dl className="flex flex-col gap-2 text-ui">
                    {state.expenses.map((e) => (
                      <div key={e.id} className="flex justify-between gap-3">
                        <dt className="min-w-0 truncate">{e.name}</dt>
                        <dd className="tabular-nums">{formatRupiah(e.amount)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3 border-t border-hairline-mist pt-2">
                      <dt>Total · {state.participants.length} peserta</dt>
                      <dd className="text-lead tabular-nums">{formatRupiah(total)}</dd>
                    </div>
                  </dl>
                </Card>
                <PeopleTable people={view.people} names={names} me={me} />
              </section>
            </>
          }
        />
      )}

      <p className="text-caption">Dicatat dengan Magerrr. Magerrr tidak memproses atau menyimpan uang; transfer langsung ke penerima.</p>
    </Page>
  );
}
