import { buildLayoutCopy } from "#lib/shell/layout-server-data.js";
import { getDemoView } from "@/features/demo/server/demo-workspace";
import type { PageServerLoad } from "./$types";

// Pure public directory: never read a principal, personal summary or business API.
export const load: PageServerLoad = ({ locals }) => ({
  campusCopy: buildLayoutCopy(locals.locale),
  pageDemo: locals.demo ?? null,
  campusDemo: locals.demo ? getDemoView(locals.demo, locals.locale) : null,
  pageLocale: locals.locale,
});
