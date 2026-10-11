"use client";

import { useState } from "react";
import { Badge, Button, Notice, inputBase } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

export interface PickerMember {
  id: string;
  display_name: string;
  user_id: string | null;
}

/** Daftar centang peserta hadir + tambah tamu cepat (PRD S2). */
export function AttendeePicker({
  groupId,
  members,
  selected,
  onChange,
  onMemberAdded,
}: {
  groupId: string;
  members: PickerMember[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  onMemberAdded: (member: PickerMember) => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  }

  async function addGuest() {
    if (!guestName.trim()) return;
    setAdding(true);
    setError(null);
    const result = await sendJson<PickerMember>(`/api/groups/${groupId}/members`, "POST", { displayName: guestName });
    setAdding(false);
    if (!result.ok) return setError(result.error);
    onMemberAdded(result.data);
    onChange(new Set(selected).add(result.data.id));
    setGuestName("");
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="sr-only">Peserta hadir</legend>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-lead" aria-live="polite">
          {selected.size} hadir
        </p>
        <Button variant="secondary" onClick={() => onChange(new Set(members.map((m) => m.id)))}>
          Pilih semua
        </Button>
        <Button variant="secondary" onClick={() => onChange(new Set())}>
          Kosongkan
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white">
        {members.map((m) => (
          <li key={m.id}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4">
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={(e) => toggle(m.id, e.target.checked)}
                className="size-6 shrink-0 accent-ink-black"
              />
              <span className="min-w-0 flex-1 truncate text-ui">{m.display_name}</span>
              {m.user_id === null && <Badge tone="outline">Tamu</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          aria-label="Nama tamu baru"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addGuest();
            }
          }}
          maxLength={40}
          autoComplete="off"
          className={`${inputBase} min-w-0 flex-1`}
        />
        <Button variant="secondary" onClick={addGuest} disabled={adding || !guestName.trim()} className="min-h-13">
          Tambah tamu
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </fieldset>
  );
}
