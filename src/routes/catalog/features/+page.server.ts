import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/**
 * The product directory moved to `/`, which is now the one home for every
 * visitor. This path kept its own social metadata and may be linked
 * externally, so it answers permanently rather than disappearing.
 */
export const load: PageServerLoad = async () => {
  throw redirect(301, "/");
};
