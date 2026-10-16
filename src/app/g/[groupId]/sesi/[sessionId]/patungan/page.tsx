import type { Metadata } from "next";
import Link from "next/link";
import { BillProgressCard, PaymentInfoList, PeopleTable, TransferList } from "@/components/bill";
import { PaymentActions, RecomputeButton, SelfReportButton, ShareBill } from "@/components/bill-actions";
import { NoAccess } from "@/components/no-access";
import { Card, Notice, Page, Split, TopBar, textLinkClass } from "@/components/ui";
import { isStale, loadBillView } from "@/lib/db/bill";
import { getGroup } from "@/lib/db/groups";
import { listMembers } from "@/lib/db/members";
import { getSession } from "@/lib/db/sessions";
import { formatDateId, formatRupiah } from "@/lib/format";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../../access";
import { ExpensesPanel } from "./expenses-panel";
import { FlatFeeForm } from "./flat-fee-form";

export const metadata: Metadata = { title: "Patungan" };

export default async function SplitBillPage({ params }: PageProps<"/g/[groupId]/sesi/[sessionId]/patungan">) {
  const { groupId, sessionId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/sesi/${sessionId}/patungan`} />;
  const { member, via } = access.membership;
  const isAdmin = member.role === "admin" && via === "account";

  const [group, session, members] = await Promise.all([
    getGroup(groupId),
    isUuid(sessionId) ? getSession(groupId, sessionId) : null,
    listMembers(groupId),
  ]);
  if (!session) {
    return (
      <Page>
        <TopBar back={`/g/${groupId}`} title={group.name} />
        <Card>
          <h1 className="text-sub">Sesi tidak ditemukan</h1>
        </Card>
      </Page>
    );
  }

  const view = await loadBillView(group, session);
  const { state, names } = view;
  const byName = (ids: string[]) => [...ids].sort((a, b) => (names[a] ?? "").localeCompare(names[b] ?? "", "id"));
  const participants = byName(state.participants);
  const payers = [...participants, ...byName(members.map((m) => m.id).filter((id) => !state.participants.includes(id)))];
  const stale = isAdmin && isStale(state, group.roundTo);
  const api = `/api/groups/${groupId}/sessions/${session.id}`;
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);

  const flat = state.flatFee;
  const hostName = names[state.hostId] ?? "pengelola";
  // Iuran flat menagih walau belum ada biaya tercatat (MAGERRR-14).
  const hasBill = state.expenses.length > 0 || (flat !== null && state.settlements.length > 0);

  const costs = (
    <>
      {state.settlements.length > 0 && <BillProgressCard progress={view.progress} />}

      {stale && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-coral-pop bg-pure-white p-4" data-testid="stale-bill">
          <p className="text-small">
            Tagihan tersimpan belum mengikuti peserta, biaya, atau aturan pembulatan terbaru. Hitung ulang agar angkanya sesuai.
          </p>
          <RecomputeButton url={`${api}/bill`} />
        </div>
      )}

      <FlatFeeForm url={`${api}/bill`} flatFee={flat} hostName={hostName} names={names} isAdmin={isAdmin} />

      <section aria-labelledby="biaya" className="flex flex-col gap-3">
        <h2 id="biaya" className="text-sub">
          Biaya
        </h2>
        <ExpensesPanel
          groupId={groupId}
          sessionId={session.id}
          expenses={state.expenses}
          names={names}
          participants={participants}
          payers={payers}
          defaultPayer={state.hostId || member.id}
          isAdmin={isAdmin}
          flat={flat !== null}
        />
      </section>
    </>
  );

  return (
    <Page width={hasBill ? "wide" : "regular"}>
      <TopBar back={`/g/${groupId}/sesi/${session.id}`} title={formatDateId(session.startsAt)} />
      <div className="flex flex-col gap-1">
        <h1 className="text-title">Patungan</h1>
        <p className="text-small">
          Magerrr hanya mencatat. Uang ditransfer langsung ke penalang, tidak lewat aplikasi.
        </p>
      </div>

      {/* Desktop: biaya di kiri, pembagian & pembayaran di kanan. */}
      <Split
        variant="half"
        main={costs}
        aside={
          hasBill && (
            <>
              <section aria-labelledby="transfer" className="flex flex-col gap-3">
                <h2 id="transfer" className="text-sub">
                  Siapa bayar ke siapa
                </h2>
                {flat !== null ? (
                  <p className="text-small" data-testid="flat-summary">
                    Iuran flat {formatRupiah(flat)} × {participants.length} peserta = {formatRupiah(flat * participants.length)}, dibayar ke {hostName}.
                    Biaya {formatRupiah(total)} ditanggung {hostName}
                    {flat * participants.length > total
                      ? `; kelebihan ${formatRupiah(flat * participants.length - total)} untuk ${hostName}.`
                      : flat * participants.length < total
                        ? `; kekurangan ${formatRupiah(total - flat * participants.length)} ditanggung ${hostName}.`
                        : "."}
                  </p>
                ) : (
                  <p className="text-small">
                    Total {formatRupiah(total)} dibagi {participants.length} peserta. Tagihan dibulatkan ke atas
                    {group.roundTo > 1 ? ` ke kelipatan ${formatRupiah(group.roundTo)}` : ""}; kelebihannya untuk host.
                  </p>
                )}
                <TransferList
                  settlements={state.settlements}
                  names={names}
                  me={member.id}
                  actions={(s) =>
                    isAdmin ? (
                      <PaymentActions url={`${api}/settlements/${s.id}`} settlement={s} />
                    ) : s.from === member.id && s.status !== "paid" && !s.selfReported ? (
                      <SelfReportButton url={`/api/s/${session.shareToken}/settlements/${s.id}/self-report`} />
                    ) : null
                  }
                />
              </section>

              <section aria-labelledby="rincian" className="flex flex-col gap-3">
                <h2 id="rincian" className="text-sub">
                  Rincian per orang
                </h2>
                <PeopleTable people={view.people} names={names} me={member.id} />
              </section>

              <section aria-labelledby="rekening" className="flex flex-col gap-3">
                <h2 id="rekening" className="text-sub">
                  Info pembayaran
                </h2>
                {view.payTo.map((p) => (
                  <Card key={p.memberId} className="flex flex-col gap-3">
                    <h3 className="text-lead">{names[p.memberId] ?? "?"}</h3>
                    {p.infos.length > 0 ? (
                      <PaymentInfoList infos={p.infos} qrSrc={(id) => `/api/groups/${groupId}/payment-infos/${id}/qris`} />
                    ) : (
                      <p className="text-small">Belum ada info rekening.</p>
                    )}
                    {p.memberId === member.id && (
                      <Link href={`/g/${groupId}/pembayaran?kembali=${encodeURIComponent(`/g/${groupId}/sesi/${session.id}/patungan`)}`} className={textLinkClass}>
                        Atur info pembayaranmu
                      </Link>
                    )}
                  </Card>
                ))}
              </section>

              <section aria-labelledby="bagikan" className="flex flex-col gap-3">
                <h2 id="bagikan" className="text-sub">
                  Bagikan tagihan
                </h2>
                {view.payTo.every((p) => p.infos.length === 0) && (
                  <Notice>Tambahkan info rekening dulu agar pemain tahu harus transfer ke mana.</Notice>
                )}
                <ShareBill text={view.text} url={view.publicUrl} token={session.shareToken} />
              </section>
            </>
          )
        }
      />
    </Page>
  );
}
