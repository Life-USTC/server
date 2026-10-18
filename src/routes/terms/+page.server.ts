import { getLegalPageContent } from "@/features/legal/server/legal-content";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => ({
  content: getLegalPageContent(locals.locale, "terms"),
});
