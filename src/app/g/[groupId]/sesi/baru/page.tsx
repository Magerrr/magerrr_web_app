import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { Page, TopBar } from "@/components/ui";
import { playersOf } from "@/lib/core/roles";
import { getGroup } from "@/lib/db/groups";
import { listMembers } from "@/lib/db/members";
import { SHUTTLE_COUNTER } from "@/lib/db/bill";
import { getSession, lastPresentMemberIds, type SessionDetail } from "@/lib/db/sessions";
import { formatShortDateId } from "@/lib/format";
import { nextWeeklyDate, toJakartaParts } from "@/lib/time";
import { isUuid } from "@/lib/validation";
import { pageAccess } from "../../access";
import { todayInJakarta } from "../defaults";
import { SessionForm } from "../session-form";
import { toOfferedMode } from "../status";

export const metadata: Metadata = { title: "Buat sesi" };

/** Rincian biaya awal sesi sumber untuk duplikat: tarif sewa per jam (meta preset court) & kok rata. */
function sourceCosts(source: SessionDetail): { courtPerHour: number | null; shuttle: number | null } {
  const court = source.expenses.find((e) => e.preset === "court" && typeof (e.meta as { perHour?: unknown } | null)?.perHour === "number");
  const shuttle = source.expenses.find((e) => e.preset === "shuttle" && (e.meta as { source?: string } | null)?.source !== SHUTTLE_COUNTER);
  return { courtPerHour: court ? (court.meta as { perHour: number }).perHour : null, shuttle: shuttle?.amount ?? null };
}

export default async function NewSessionPage({ params, searchParams }: PageProps<"/g/[groupId]/sesi/baru">) {
  const { groupId } = await params;
  const dari = (await searchParams).dari;
  const access = await pageAccess(groupId, "admin");
  if (access.denied) return <NoAccess reason={access.denied} next={`/g/${groupId}/sesi/baru`} />;
  const { member } = access.membership;

  const [group, allMembers, lastPresent, source] = await Promise.all([
    getGroup(groupId),
    listMembers(groupId),
    lastPresentMemberIds(groupId),
    typeof dari === "string" && isUuid(dari) ? getSession(groupId, dari) : null,
  ]);
  // Wasit mengurus permainan dan tidak jadi peserta (MAGERRR-11).
  const members = playersOf(allMembers);
  const today = todayInJakarta();
  const from = source ? toJakartaParts(source.startsAt) : null;
  const activeIds = new Set(members.map((m) => m.id));
  const sourcePresent = source ? source.presentIds.filter((id) => activeIds.has(id)) : [];

  return (
    <Page width="narrow">
      <TopBar back={`/g/${groupId}`} title={group.name} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">{source ? "Duplikat sesi" : "Buat sesi"}</h1>
        <p className="text-ui">
          {source
            ? `Diisi dari sesi ${formatShortDateId(source.startsAt)} untuk minggu berikutnya.`
            : lastPresent.length > 0
              ? "Peserta diisi dari sesi terakhir."
              : "Centang siapa saja yang ikut main."}{" "}
          Semua bisa diubah nanti.
        </p>
      </div>
      <SessionForm
        groupId={groupId}
        defaults={
          source && from
            ? {
                date: nextWeeklyDate(from.date, today),
                time: from.time,
                durationMin: source.durationMin ?? 120,
                venue: source.venue,
                courtCount: source.courtCount,
                playMode: toOfferedMode(source.playMode),
                rules: source.rules ?? group.rules,
                matchGames: source.matchGames ?? group.matchGames,
                note: source.note,
              }
            : {
                date: today,
                time: "19:00",
                durationMin: 120,
                venue: null,
                courtCount: 1,
                playMode: toOfferedMode(group.defaultPlayMode),
                rules: group.rules,
                matchGames: group.matchGames,
                note: null,
              }
        }
        create={{
          members,
          initialSelected: sourcePresent.length > 0 ? sourcePresent : lastPresent.length > 0 ? lastPresent : [member.id],
          selfMemberId: member.id,
          roundTo: group.roundTo,
          initialCosts: source ? sourceCosts(source) : undefined,
        }}
      />
    </Page>
  );
}
