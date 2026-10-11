import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Page, TopBar } from "@/components/ui";
import { getUser } from "@/lib/db/authz";
import { CreateGroupForm } from "./create-group-form";

export const metadata: Metadata = { title: "Buat grup" };

export default async function NewGroupPage() {
  if (!(await getUser())) redirect("/masuk?next=/grup/baru");
  return (
    <Page width="narrow">
      <TopBar back="/" />
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Buat grup</h1>
        <p className="text-ui">Kamu jadi admin grup ini. Aturan skor dan patungan bisa diubah nanti.</p>
      </div>
      <CreateGroupForm />
    </Page>
  );
}
