import { error } from "@sveltejs/kit";
import { getCoursePage, getTeacherPage } from "@/lib/page-data";
import { loadCatalogDetailCommentsData } from "./catalog-detail-comments";
import {
  getCourseDetailCopy,
  getTeacherDetailCopy,
} from "./catalog-detail-copy";
import { normalizeCatalogTab } from "./catalog-detail-tabs";
import { currentCatalogViewer } from "./catalog-detail-viewer";

export async function loadCourseDetailPage({
  locals,
  params,
  request,
  url,
}: {
  locals: App.Locals;
  params: { jwId: string };
  request: Request;
  url: URL;
}) {
  const copy = getCourseDetailCopy(locals.locale);
  const jwId = Number(params.jwId);
  if (!Number.isInteger(jwId)) error(404, copy.notFound.description);
  const course = await getCoursePage(jwId, locals.locale);
  if (!course) error(404, copy.notFound.description);
  const viewer = await currentCatalogViewer(request);
  const { commentsData, descriptionData } = await loadCatalogDetailCommentsData(
    {
      targetId: course.id,
      type: "course",
      viewer,
    },
  );
  return {
    course,
    locale: locals.locale,
    copy,
    descriptionData,
    commentsData,
    tab: normalizeCatalogTab(url.searchParams.get("tab")),
  };
}

export async function loadTeacherDetailPage({
  locals,
  params,
  request,
  url,
}: {
  locals: App.Locals;
  params: { id: string };
  request: Request;
  url: URL;
}) {
  const copy = getTeacherDetailCopy(locals.locale);
  const id = Number(params.id);
  if (!Number.isInteger(id)) error(404, copy.notFound.description);
  const teacher = await getTeacherPage(id, locals.locale);
  if (!teacher) error(404, copy.notFound.description);
  const viewer = await currentCatalogViewer(request);
  const { commentsData, descriptionData } = await loadCatalogDetailCommentsData(
    {
      targetId: teacher.id,
      type: "teacher",
      viewer,
    },
  );
  return {
    teacher,
    locale: locals.locale,
    copy,
    descriptionData,
    commentsData,
    tab: normalizeCatalogTab(url.searchParams.get("tab")),
  };
}
