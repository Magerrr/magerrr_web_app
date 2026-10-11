import { readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/db/authz";
import { createGroup } from "@/lib/db/groups";
import { groupCreateSchema } from "@/lib/validation";

/** Buat grup; pembuatnya otomatis admin. */
export const POST = route(async (request) => {
  const user = await requireUser();
  const input = await readJson(request, groupCreateSchema);
  const id = await createGroup(user, input);
  return Response.json({ id }, { status: 201 });
});
