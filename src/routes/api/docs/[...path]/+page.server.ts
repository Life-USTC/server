import { requireDemoApiDocsPath } from "@/features/api-docs/server/demo-api-docs";
import { getDemoView } from "@/features/demo/server/demo-workspace";
import { loadApiDocsPageData } from "../api-docs-page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request, url }) => {
  // Track every document navigation, including the ordinary owner before Demo.
  const pathname = url.pathname;
  if (locals.demo) await requireDemoApiDocsPath(request, pathname);
  return {
    ...loadApiDocsPageData(locals.locale),
    pageDemo: locals.demo ? getDemoView(locals.demo, locals.locale) : null,
    pageLocale: locals.locale,
  };
};
