import type { Metadata } from "next";
import { PaymentInfoList } from "@/components/bill";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { listPaymentInfos } from "@/lib/db/payments";
import { safeNextPath } from "@/lib/validation";
import { pageAccess } from "../access";
import { AddPaymentInfo, DeletePaymentInfo } from "./payment-info-editor";

export const metadata: Metadata = { title: "Info pembayaran" };

/** Info pembayaran milik pengunjung di grup ini (PRD P6). */
export default async function PaymentInfoPage({ params, searchParams }: PageProps<"/g/[groupId]/pembayaran">) {
  const { groupId } = await params;
  const access = await pageAccess(groupId, "member");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/pembayaran`} />;
  const { member } = access.membership;
  const back = safeNextPath((await searchParams).kembali, `/g/${groupId}`);
  const [group, infos] = await Promise.all([getGroup(groupId), listPaymentInfos([member.id])]);

  return (
    <Page width="narrow">
      <TopBar back={back} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Info pembayaran</h1>
        <p className="text-ui">
          Tampil di tagihan saat kamu menalangi biaya, supaya pemain tahu harus transfer ke mana. Magerrr tidak memproses uang.
        </p>
      </div>
      {infos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {infos.map((info) => (
            <li key={info.id} className="flex flex-col gap-2">
              <PaymentInfoList infos={[info]} qrSrc={(id) => `/api/groups/${groupId}/payment-infos/${id}/qris`} />
              <DeletePaymentInfo groupId={groupId} id={info.id} label={info.label} />
            </li>
          ))}
        </ul>
      )}
      <AddPaymentInfo groupId={groupId} />
    </Page>
  );
}
