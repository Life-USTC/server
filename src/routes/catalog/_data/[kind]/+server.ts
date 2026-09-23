import { error, json, type RequestHandler } from "@sveltejs/kit";
import {
  getCourseListPage,
  getSectionListPage,
  getTeacherListPage,
} from "@/features/catalog/server/public-page-list-data";

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (params.kind === "courses") {
    return json(await getCourseListPage(url, locals.locale));
  }
  if (params.kind === "sections") {
    return json(await getSectionListPage(url, locals.locale));
  }
  if (params.kind === "teachers") {
    return json(await getTeacherListPage(url, locals.locale));
  }
  error(404, "Catalog page data not found");
};
