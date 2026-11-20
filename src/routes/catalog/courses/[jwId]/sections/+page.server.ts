import { loadCourseDetailPage } from "@/features/catalog/server/catalog-detail-page-server";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = loadCourseDetailPage;
