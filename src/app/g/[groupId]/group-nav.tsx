"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface Item {
  href: string;
  label: string;
  /** halaman di bawahnya juga dianggap bagian menu ini */
  nested?: string[];
  badge?: number;
}

/** Menu sidebar grup (desktop). Penanda aktif dari URL: `aria-current="page"` di halamannya, `"true"` di sub-halaman. */
export function GroupNav({ groupId, isAdmin, unread }: { groupId: string; isAdmin: boolean; unread: number }) {
  const pathname = usePathname();
  const base = `/g/${groupId}`;
  const onChat = pathname.startsWith(`${base}/obrolan`);

  // Layout tidak dirender ulang saat pindah halaman, jadi `unread` bisa usang: setelah obrolan dibuka, penanda
  // disembunyikan sampai server mengirim angka baru (router.refresh atau muat ulang).
  const [read, setRead] = useState({ unread, seen: onChat });
  if (read.unread !== unread) setRead({ unread, seen: onChat });
  else if (onChat && !read.seen) setRead({ unread, seen: true });
  const badge = read.seen || onChat ? 0 : unread;

  const items: Item[] = [
    { href: base, label: "Sesi", nested: [`${base}/sesi`] },
    { href: `${base}/obrolan`, label: "Obrolan", badge },
    { href: `${base}/kiko`, label: "Kiko kamu" },
    { href: `${base}/leaderboard`, label: "Leaderboard" },
    { href: `${base}/musim`, label: "Musim" },
    { href: `${base}/anggota`, label: "Anggota", nested: [`${base}/anggota`] },
    { href: `${base}/pembayaran`, label: "Info pembayaran" },
    ...(isAdmin ? [{ href: `${base}/pengaturan`, label: "Pengaturan grup" }] : []),
  ];

  return (
    <nav aria-label="Navigasi grup">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const exact = pathname === item.href;
          const within = !exact && (item.nested ?? []).some((prefix) => pathname.startsWith(`${prefix}/`));
          const count = item.badge ?? 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={exact ? "page" : within ? "true" : undefined}
                className={
                  "flex min-h-11 items-center gap-3 rounded-full px-4 text-ui " +
                  (exact || within ? "bg-ink-black text-cream-paper" : "text-ink-black hover:bg-sandstone")
                }
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {count > 0 && (
                  <>
                    <span
                      className="flex h-6 min-w-6 items-center justify-center rounded-full border border-ink-black bg-fresh-grass px-1.5 text-caption text-ink-black"
                      aria-hidden="true"
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                    <span className="sr-only">, {count} pesan baru</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
