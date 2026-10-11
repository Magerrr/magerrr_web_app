"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { inputClass } from "@/components/ui";

/** Pilihan yang masing-masing berupa URL halaman (mis. periode leaderboard, lawan head-to-head). */
export function LinkSelect({
  label,
  value,
  options,
  className = "",
}: {
  label: string;
  value: string;
  options: { href: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const id = useId();
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <select id={id} className={inputClass} value={value} onChange={(e) => router.push(e.target.value)}>
        {options.map((o) => (
          <option key={o.href} value={o.href}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
