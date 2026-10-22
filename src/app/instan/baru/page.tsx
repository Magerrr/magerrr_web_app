import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { todayInJakarta } from "@/app/g/[groupId]/sesi/defaults";
import { Page, TopBar } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { InstantForm } from "./instant-form";

export const metadata: Metadata = { title: "Buat Mabar Instan" };

export default async function NewInstantPage() {
  if (!(await getUser())) redirect("/masuk?next=/instan/baru");
  return (
    <Page width="narrow">
      <TopBar back="/" />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Buat Mabar Instan</h1>
        <p className="text-ui">Isi detail, bagikan tautannya, dan teman bisa ikut tanpa akun.</p>
      </div>
      <InstantForm today={todayInJakarta()} />
    </Page>
  );
}
