import type { Metadata } from "next";
import { Card, Page } from "@/components/ui";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Offline" };

/** Ditampilkan service worker saat tidak ada koneksi dan halaman belum pernah dibuka. */
export default function OfflinePage() {
  return (
    <Page width="narrow">
      <p className="text-lead">Magerrr</p>
      <Card className="flex flex-col gap-3">
        <h1 className="text-sub">Kamu sedang offline</h1>
        <p className="text-ui">
          Halaman ini belum pernah dibuka di perangkat ini, jadi belum bisa ditampilkan tanpa internet. Halaman yang sudah
          pernah kamu buka tetap bisa dilihat. Skor dan biaya baru bisa disimpan setelah koneksi kembali.
        </p>
        <RetryButton />
      </Card>
    </Page>
  );
}
