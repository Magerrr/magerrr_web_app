import Link from "next/link";
import { Icon } from "@/components/icons";
import { Card, buttonClass, dateInputClass, inputBase } from "@/components/ui";
import { rangeFromParams } from "@/lib/core/public-sessions";
import { listPublicSessions, type PublicSession } from "@/lib/db/sessions";
import { formatShortDateId, formatTimeRangeId } from "@/lib/format";
import { toJakartaParts } from "@/lib/time";
import { PLAY_MODE_LABEL } from "../g/[groupId]/sesi/status";

type Param = string | string[] | undefined;
const first = (value: Param) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

const WHEN_OPTIONS = [
  { value: "", label: "Semua tanggal" },
  { value: "today", label: "Hari ini" },
  { value: "week", label: "Pekan ini" },
  { value: "date", label: "Pilih tanggal" },
] as const;

const selectClass = `${inputBase} w-full`;

/** Tab Sesi di /jelajah: cari nama grup/tempat, filter tanggal (WIB) dan mode main. Hanya baca, tanpa data peserta/skor/biaya. */
export async function SessionsTab({ searchParams }: { searchParams: Record<string, Param> }) {
  const query = first(searchParams.q).slice(0, 60);
  const when = first(searchParams.when);
  const date = first(searchParams.date);
  const mode = first(searchParams.mode);
  const playMode = Object.keys(PLAY_MODE_LABEL).includes(mode) ? (mode as keyof typeof PLAY_MODE_LABEL) : undefined;
  const range = rangeFromParams(when, date, new Date());
  const invalidDate = when === "date" && !range;

  const sessions = invalidDate ? [] : await listPublicSessions({ query, range: range ?? undefined, playMode });
  const filtered = Boolean(query || range || playMode);

  return (
    <>
      <form role="search" className="flex flex-col gap-3" data-testid="session-filter">
        <input type="hidden" name="tab" value="sesi" />
        <div className="flex gap-2">
          <label htmlFor="cari-sesi" className="sr-only">
            Cari nama grup atau tempat
          </label>
          <input
            id="cari-sesi"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Cari nama grup atau tempat"
            maxLength={60}
            className={`${inputBase} min-w-0 flex-1`}
          />
          <button type="submit" className={buttonClass("primary", "md", "min-h-13 px-4")} aria-label="Cari">
            <Icon name="search" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1 text-small font-medium">
            Waktu
            <select name="when" defaultValue={when} className={selectClass}>
              {WHEN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-small font-medium">
            Tanggal (untuk &quot;Pilih tanggal&quot;)
            <input type="date" name="date" defaultValue={date} min={toJakartaParts(new Date()).date} className={dateInputClass} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-small font-medium">
            Mode main
            <select name="mode" defaultValue={playMode ?? ""} className={selectClass}>
              <option value="">Semua mode</option>
              {Object.entries(PLAY_MODE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonClass("primary", "md", "px-5")}>
            Terapkan
          </button>
          {filtered && (
            <Link href="/jelajah?tab=sesi" className={buttonClass("secondary", "md", "px-5")}>
              Reset
            </Link>
          )}
        </div>
      </form>

      {invalidDate && <p className="text-ui">Pilih tanggal yang valid dulu.</p>}

      {sessions.length === 0 ? (
        <Card>
          <p className="text-ui">{filtered ? "Tidak ada sesi publik yang cocok dengan pencarianmu." : "Belum ada sesi publik yang akan datang."}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="public-sessions">
          {sessions.map((s) => (
            <li key={s.id} className="min-w-0">
              <SessionCard session={s} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SessionCard({ session: s }: { session: PublicSession }) {
  return (
    <Link
      href={`/jelajah/sesi/${s.id}`}
      className="flex h-full min-h-11 flex-col gap-2 rounded-2xl border border-ink-black bg-pure-white p-4 hover:bg-cream-paper"
    >
      <span className="truncate text-lead">
        {s.groupEmoji ? `${s.groupEmoji} ` : ""}
        {s.groupName}
      </span>
      <span className="text-ui">
        {formatShortDateId(s.startsAt)} · {formatTimeRangeId(s.startsAt, s.durationMin)}
      </span>
      {s.venue && <span className="text-small break-words">{s.venue}</span>}
      <span className="text-small">
        {s.courtCount} lapangan · {PLAY_MODE_LABEL[s.playMode]} · {s.goingCount} ikut
      </span>
    </Link>
  );
}
