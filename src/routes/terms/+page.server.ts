import { getLegalContent } from "@/lib/legal-content";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => ({
  content: getLegalContent(locals.locale, "terms"),
});
