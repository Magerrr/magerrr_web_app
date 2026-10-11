import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Card, Page, TopBar, textLinkClass } from "@/components/ui";
import { counterpartBalances, memberBalances, type CounterpartBalance } from "@/lib/core/balance";
import { getGroup } from "@/lib/db/groups";
import { memberNames } from "@/lib/db/members";
import { unpaidGroupSettlements, type MemberSettlement } from "@/lib/db/profile";
import { formatRupiah, formatShortDateId } from "@/lib/format";
import { pageAccess } from "../access";

export const metadata: Metadata = { title: "Saldo patungan" };

/** "Kurang bayar Rp5.000" / "Akan terima Rp15.000" / "Impas" untuk saldo bersih. */
function netLabel(net: number): string {
  return net < 0 ? `Kurang bayar ${formatRupiah(-net)}` : net > 0 ? `Akan terima ${formatRupiah(net)}` : "Impas";
}

function counterpartLabel(c: CounterpartBalance, name: string): string {
  return c.net < 0 ? `Bayar ke ${name}` : c.net > 0 ? `Terima dari ${name}` : `Impas dengan ${name}`;
}

/** Saldo utang/piutang lintas sesi per anggota (PRD P10). Pencatatan saja; pelunasan tetap per sesi. */
export default async function BalancePage({ params }: PageProps<"/g/[groupId]/saldo">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/saldo`} />;
  const me = access.membership.member.id;
  const [group, names, settlements] = await Promise.all([getGroup(groupId), memberNames(groupId), unpaidGroupSettlements(groupId)]);
  const name = (id: string) => names[id] ?? "?";
  const rows = memberBalances(settlements);
  const mine = counterpartBalances(settlements, me);
  const between = (other: string): MemberSettlement[] =>
    settlements.filter((s) => (s.from === me && s.to === other) || (s.from === other && s.to === me));

  return (
    <Page width="regular">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Saldo patungan</h1>
        <p className="text-ui">
          Dihitung dari transfer patungan yang belum lunas di semua sesi. Tandai lunas di halaman patungan tiap sesi. Magerrr tidak memproses uang.
        </p>
      </div>

      <section aria-labelledby="saldo-kamu" className="flex flex-col gap-3">
        <h2 id="saldo-kamu" className="text-sub">
          Saldo kamu
        </h2>
        {mine.length === 0 ? (
          <Card data-testid="my-balance">
            <p className="text-ui">Kamu tidak punya tagihan yang belum lunas.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="my-balance">
            {mine.map((c) => (
              <li key={c.memberId} className="flex flex-col gap-2 rounded-2xl border border-ink-black bg-pure-white p-4" data-testid="counterpart">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-lead">{counterpartLabel(c, name(c.memberId))}</span>
                  <span className="text-lead tabular-nums">{formatRupiah(Math.abs(c.net))}</span>
                </div>
                {c.owes > 0 && c.owed > 0 && (
                  <p className="text-small">
                    Bersih dari kamu bayar {formatRupiah(c.owes)} dan terima {formatRupiah(c.owed)}. Pelunasan tetap ditandai per sesi.
                  </p>
                )}
                <ul className="flex flex-col">
                  {between(c.memberId).map((s) => (
                    <li key={s.id} className="flex min-h-11 items-center justify-between gap-3 text-small">
                      <Link href={`/g/${groupId}/sesi/${s.sessionId}/patungan`} className={textLinkClass}>
                        {formatShortDateId(s.startsAt)}
                        {s.venue ? ` · ${s.venue}` : ""}
                      </Link>
                      <span className="tabular-nums">
                        {s.from === me ? "kamu bayar" : "kamu terima"} {formatRupiah(s.amount)}
                        {s.selfReported && " · menunggu konfirmasi"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="semua-anggota" className="flex flex-col gap-3">
        <h2 id="semua-anggota" className="text-sub">
          Semua anggota
        </h2>
        {rows.length === 0 ? (
          <Card>
            <p className="text-ui">Semua tagihan patungan sudah lunas.</p>
          </Card>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white" data-testid="balances">
            {rows.map((r) => (
              <li
                key={r.memberId}
                className={`flex items-center gap-3 px-4 py-2 first:rounded-t-2xl last:rounded-b-2xl ${r.memberId === me ? "bg-fresh-grass" : ""}`}
                data-testid="balance-row"
              >
                <Link href={`/g/${groupId}/anggota/${r.memberId}`} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                  <span className="truncate text-ui">
                    {name(r.memberId)}
                    {r.memberId === me && " (kamu)"}
                  </span>
                  <span className="text-small tabular-nums">
                    Belum bayar {formatRupiah(r.owes)} · belum diterima {formatRupiah(r.owed)}
                  </span>
                </Link>
                <span className="shrink-0 text-right text-ui tabular-nums">{netLabel(r.net)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
