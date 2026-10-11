import type { Metadata } from "next";
import { Card, ButtonLink, Page, TopBar } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { findClaimTarget } from "@/lib/db/members";
import { ClaimButton } from "./claim-button";

export const metadata: Metadata = { title: "Klaim profil", robots: { index: false, follow: false } };

/** Klaim profil tamu (PRD G6): riwayat match & tagihan tamu jadi milik akun yang login. */
export default async function ClaimPage({ params }: PageProps<"/klaim/[token]">) {
  const { token } = await params;
  const [target, user] = await Promise.all([findClaimTarget(token), getUser()]);
  if (!target) {
    return (
      <Page width="narrow">
        <TopBar back="/" />
        <Card className="flex flex-col gap-2">
          <h1 className="text-sub">Tautan klaim tidak berlaku</h1>
          <p className="text-ui">Profil ini sudah diklaim atau tautannya salah. Minta tautan baru ke admin grup.</p>
        </Card>
      </Page>
    );
  }
  return (
    <Page width="narrow">
      <TopBar back="/" />
      <div className="flex flex-col gap-2">
        <p className="text-small">{target.groupName}</p>
        <h1 className="text-title break-words">Klaim profil {target.displayName}</h1>
        <p className="text-ui">
          Hubungkan profil tamu ini ke akunmu. Riwayat match, statistik, dan tagihan tetap utuh, dan kamu bisa membukanya dari perangkat mana pun.
        </p>
      </div>
      {user ? (
        <>
          <p className="text-small">Masuk sebagai {user.email ?? "akunmu"}.</p>
          <ClaimButton token={token} name={target.displayName} />
        </>
      ) : (
        <ButtonLink href={`/masuk?next=${encodeURIComponent(`/klaim/${token}`)}`} size="lg">
          Masuk untuk mengklaim
        </ButtonLink>
      )}
    </Page>
  );
}
