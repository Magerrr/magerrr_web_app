import { NoAccess } from "@/components/no-access";
import { Card, Page, TopBar } from "@/components/ui";
import { getGroup } from "@/lib/db/groups";
import { loadPlay } from "@/lib/db/play";
import { getSession } from "@/lib/db/sessions";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../../access";
import { MatchForm } from "./match-form";

/** Halaman bersama untuk catat manual (tanpa matchId) dan ubah skor (dengan matchId). */
export async function MatchFormPage({ groupId, sessionId, matchId }: { groupId: string; sessionId: string; matchId?: string }) {
  const path = `/g/${groupId}/sesi/${sessionId}/catat${matchId ? `/${matchId}` : ""}`;
  const access = await pageAccess(groupId, "admin");
  if (access.denied) return <NoAccess reason={access.denied} next={path} />;

  const [group, session] = await Promise.all([getGroup(groupId), isUuid(sessionId) ? getSession(groupId, sessionId) : null]);
  const back = `/g/${groupId}/sesi/${sessionId}/main`;
  const ctx = session ? await loadPlay(group, session) : null;
  const match = matchId ? ctx?.matches.find((m) => m.id === matchId && m.status === "completed") : undefined;
  if (!session || !ctx || (matchId && !match)) {
    return (
      <Page width="narrow">
        <TopBar back={back} title={group.name} />
        <Card>
          <h1 className="text-sub">{session ? "Match tidak ditemukan atau tidak bisa diedit" : "Sesi tidak ditemukan"}</h1>
        </Card>
      </Page>
    );
  }

  const present = new Set(session.presentIds);
  return (
    <Page width="narrow">
      <TopBar back={back} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">{match ? `Ubah skor match #${match.order}` : "Catat match"}</h1>
        <p className="text-ui">
          {match
            ? "Perubahan dicatat di riwayat audit (siapa, kapan, sebelum dan sesudah)."
            : "Untuk match yang skornya dicatat setelah selesai main."}
        </p>
      </div>
      <MatchForm
        groupId={groupId}
        sessionId={sessionId}
        players={ctx.members.filter((m) => present.has(m.id)).map((m) => ({ id: m.id, name: m.display_name }))}
        courtCount={session.courtCount}
        rules={match?.rules ?? ctx.rules}
        gamesMax={match?.gamesMax ?? ctx.gamesMax}
        initial={
          match && { matchId: match.id, kind: match.kind, courtNo: match.courtNo, A: match.players.A, B: match.players.B, games: match.games }
        }
      />
    </Page>
  );
}
