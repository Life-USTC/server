import { renderMarkdown } from "@/lib/components/markdown-preview-renderer";
import { getLegalContent } from "@/lib/legal-content";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
  const content = getLegalContent(locals.locale, "privacy");
  return {
    content: {
      ...content,
      renderedHtml: renderMarkdown(content.mdx),
    },
  };
};
