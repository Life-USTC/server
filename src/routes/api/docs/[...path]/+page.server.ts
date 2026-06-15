import { loadApiDocsPageData } from "../api-docs-page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) =>
  loadApiDocsPageData(locals.locale);
