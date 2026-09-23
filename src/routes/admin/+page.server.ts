import { redirect } from "@sveltejs/kit";
import { requireAdminPage } from "@/features/admin/server/admin-page-auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ request }) => {
  await requireAdminPage(request);
  throw redirect(303, "/admin/users");
};
