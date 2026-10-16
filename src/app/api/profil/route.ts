import { readJson, route } from "@/lib/api";
import { renameAccount } from "@/lib/db/account";
import { requireUser } from "@/lib/db/authz";
import { accountNameSchema } from "@/lib/validation";

/** Ubah nama profil akun (MAGERRR-12). `skipped` = grup yang namanya tidak ikut diganti karena sudah dipakai. */
export const PATCH = route(async (request) => {
  const user = await requireUser();
  const { displayName, applyToGroups } = await readJson(request, accountNameSchema);
  return Response.json(await renameAccount(user.id, displayName, applyToGroups));
});
