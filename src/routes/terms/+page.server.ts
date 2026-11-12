import { prepareDemoInformationHtml } from "@/features/demo/server/demo-information-html";
import { getDemoView } from "@/features/demo/server/demo-workspace";
import { getLegalPageContent } from "@/features/legal/server/legal-content";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
  const content = getLegalPageContent(locals.locale, "terms");
  return {
    pageDemo: locals.demo ?? null,
    pageLocale: locals.locale,
    content: locals.demo
      ? {
          ...content,
          renderedHtml: prepareDemoInformationHtml(
            content.renderedHtml,
            getDemoView(locals.demo, locals.locale).readOnlyReason,
            url.origin,
          ),
        }
      : content,
  };
};
