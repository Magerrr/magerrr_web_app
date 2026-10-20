"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBusy } from "@/components/busy";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Field, buttonClass, inputBase, inputClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";
import type { Member } from "@/lib/db/authz";

const GRADES = ["A", "B", "C", "D"] as const;
const ROLES: { value: Member["role"]; label: string }[] = [
  { value: "member", label: "Pemain" },
  { value: "referee", label: "Wasit" },
  { value: "admin", label: "Admin" },
];

export function InviteCard({ groupId, groupName, inviteUrl, isPublic }: { groupId: string; groupName: string; inviteUrl: string; isPublic: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const shareText = `Gabung grup ${groupName} di Magerrr: ${inviteUrl}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast("Tautan disalin.");
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Salin tautan secara manual.");
    }
  }

  async function rotate() {
    if (!window.confirm("Buat tautan baru? Tautan lama langsung tidak berlaku.")) return;
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/invite`, "POST");
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast("Tautan baru dibuat. Tautan lama tidak berlaku lagi.");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-sub">Tautan undangan</h2>
        <p className="mt-1 text-small">
          Siapa pun yang punya tautan ini bisa gabung tanpa akun.
          {isPublic ? " Grup ini publik, jadi juga bisa digabung dari Jelajahi grup." : ""}
        </p>
      </div>
      <input
        aria-label="Tautan undangan"
        readOnly
        value={inviteUrl}
        onFocus={(e) => e.currentTarget.select()}
        className={`${inputClass} text-small`}
        data-testid="invite-url"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={copy}>
          Salin
        </Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("accent")}>
          Bagikan ke WhatsApp
        </a>
        <Button variant="secondary" onClick={rotate} loading={pending}>
          Buat tautan baru
        </Button>
      </div>
    </Card>
  );
}

export function AddGuestForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await sendJson(`/api/groups/${groupId}/members`, "POST", { displayName: name });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast(`${name.trim()} ditambahkan sebagai tamu.`);
    setName("");
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <Field label="Tambah pemain tamu" htmlFor="guest-name" hint="Untuk pemain tanpa HP atau yang belum buka tautan. Cukup nama panggilan.">
        <div className="flex gap-2">
          <input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            autoComplete="off"
            className={`${inputBase} min-w-0 flex-1`}
          />
          <Button type="submit" loading={pending} className="min-h-13">
            Tambah
          </Button>
        </div>
      </Field>
    </form>
  );
}

export function MemberList({
  groupId,
  members,
  selfId,
  ownerUserId,
  editable,
}: {
  groupId: string;
  members: Member[];
  selfId: string;
  ownerUserId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  useBusy(busy !== null);

  async function update(memberId: string, patch: Partial<Pick<Member, "grade" | "role">>) {
    setBusy(memberId);
    const result = await sendJson(`/api/groups/${groupId}/members/${memberId}`, "PATCH", patch);
    setBusy(null);
    if (!result.ok) return toast.error(result.error);
    toast("Anggota diperbarui.");
    router.refresh();
  }

  return (
    <section aria-labelledby="daftar-anggota" className="flex flex-col gap-3">
      <h2 id="daftar-anggota" className="text-sub">
        {members.length} anggota
      </h2>
      <ul className="flex flex-col divide-y divide-hairline-mist rounded-2xl border border-ink-black bg-pure-white">
        {members.map((m) => {
          const isOwner = m.user_id !== null && m.user_id === ownerUserId;
          const canToggleRole = editable && m.user_id !== null && m.id !== selfId && !isOwner;
          return (
            <li key={m.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center" data-testid="member-row">
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-1">
                <Link href={`/g/${groupId}/anggota/${m.id}`} className="flex min-h-11 min-w-0 flex-1 items-center text-lead underline-offset-4 hover:underline">
                  <span className="truncate">{m.display_name}</span>
                </Link>
                {m.role === "admin" && <Badge tone="accent">Admin</Badge>}
                {m.role === "referee" && <Badge tone="sunshine">Wasit</Badge>}
                {m.user_id === null && <Badge tone="outline">Tamu</Badge>}
                {m.id === selfId && <Badge>Kamu</Badge>}
                {!editable && m.grade && <Badge>Grade {m.grade}</Badge>}
              </div>
              {editable && (
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <label className="flex items-center gap-2 text-small">
                    Grade
                    <select
                      value={m.grade ?? ""}
                      disabled={busy === m.id}
                      onChange={(e) => update(m.id, { grade: (e.target.value || null) as Member["grade"] })}
                      className="h-11 rounded-lg border-1 border-ink-black bg-pure-white px-3 text-ui"
                    >
                      <option value="">Tanpa grade</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                  {canToggleRole && (
                    <label className="flex items-center gap-2 text-small">
                      Peran
                      <select
                        value={m.role}
                        disabled={busy === m.id}
                        onChange={(e) => update(m.id, { role: e.target.value as Member["role"] })}
                        className="h-11 rounded-lg border-1 border-ink-black bg-pure-white px-3 text-ui"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        <div className="flex flex-col gap-1 text-caption">
          <p>Grade A paling kuat, D pemula. Dipakai untuk kocok pasangan yang seimbang.</p>
          <p>
            Wasit mengurus permainan: kocok & mulai ronde, catat dan ubah skor, batalkan match, mulai match turnamen. Wasit tidak ikut
            main, tidak jadi peserta sesi, dan tidak ikut patungan. Pengaturan grup, anggota, sesi, dan patungan tetap khusus admin.
            Peran hanya untuk anggota yang masuk dengan akun.
          </p>
        </div>
      )}
    </section>
  );
}
