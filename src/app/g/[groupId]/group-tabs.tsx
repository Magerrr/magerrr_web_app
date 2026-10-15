"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface Props {
  groupId: string;
  memberId: string;
  /** hanya admin akun yang boleh membuat sesi: tombol (+) tampil untuknya */
  canCreate: boolean;
}

interface Tab {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** awalan path yang juga menyalakan tab ini (selain href itu sendiri) */
  within?: string[];
}

const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const HOME = (
  <svg {...ICON}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
const BOARD = (
  <svg {...ICON}>
    <path d="M4 20V12h4v8M10 20V6h4v14M16 20v-6h4v6" />
  </svg>
);
const PEOPLE = (
  <svg {...ICON}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6" />
  </svg>
);
const PROFILE = (
  <svg {...ICON}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const PLUS = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Navigasi utama grup: rail 88px di tablet (sm ≤ lebar < lg, semua halaman grup). Desktop memakai sidebar
 * (layout.tsx); ponsel tanpa bar bawah, menunya ada di dalam layar Beranda. Penanda aktif dari URL; teks aktif
 * fresh-grass di atas ink-black.
 */
export function GroupTabs({ groupId, memberId, canCreate }: Props) {
  const pathname = usePathname();
  const base = `/g/${groupId}`;
  const tabs: Tab[] = [
    { key: "beranda", href: base, label: "Beranda", icon: HOME, within: [`${base}/sesi`] },
    { key: "leaderboard", href: `${base}/leaderboard`, label: "Peringkat", icon: BOARD },
    { key: "anggota", href: `${base}/anggota`, label: "Anggota", icon: PEOPLE },
    { key: "profil", href: `${base}/anggota/${memberId}`, label: "Profil", icon: PROFILE },
  ];
  const create = canCreate ? { href: `${base}/sesi/baru`, label: "Buat sesi" } : null;

  const isActive = (tab: Tab) => pathname === tab.href || (tab.within ?? []).some((prefix) => pathname.startsWith(`${prefix}/`));

  return (
    <nav
      aria-label="Navigasi utama"
      className="sticky top-0 hidden h-dvh w-22 shrink-0 flex-col items-center gap-2 border-r border-ink-black bg-pure-white py-5 sm:flex lg:hidden"
    >
      {create && (
        <Link
          href={create.href}
          aria-label={create.label}
          className="mb-3 flex size-14 items-center justify-center rounded-full border border-ink-black bg-fresh-grass text-ink-black"
        >
          {PLUS}
        </Link>
      )}
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              "relative flex min-h-14 w-18 flex-col items-center justify-center gap-1 rounded-2xl text-caption " +
              (active ? "bg-ink-black text-fresh-grass" : "text-ink-black hover:bg-sandstone")
            }
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
