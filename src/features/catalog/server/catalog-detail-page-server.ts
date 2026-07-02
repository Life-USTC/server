import { error } from "@sveltejs/kit";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import { loadCatalogDetailCommentsData } from "./catalog-detail-comments";
import {
  getCourseDetailCopy,
  getTeacherDetailCopy,
} from "./catalog-detail-copy";
import { currentCatalogViewer } from "./catalog-detail-viewer";

export type CourseDetailRouteSection =
  | "overview"
  | "introduction"
  | "sections"
  | "comments";

export type TeacherDetailRouteSection =
  | "overview"
  | "introduction"
  | "sections"
  | "comments";

const catalogDetailRouteSections = new Set([
  "introduction",
  "sections",
  "comments",
]);

function resolveCatalogDetailRouteSection(
  section: string | undefined,
): CourseDetailRouteSection | null {
  if (!section) return "overview";
  return catalogDetailRouteSections.has(section)
    ? (section as CourseDetailRouteSection)
    : null;
}

export async function loadCourseDetailPage({
  locals,
  params,
  request,
}: {
  locals: App.Locals;
  params: { jwId: string; section?: string };
  request: Request;
}) {
  const copy = getCourseDetailCopy(locals.locale);
  const detailSection = resolveCatalogDetailRouteSection(params.section);
  if (!detailSection) error(404, copy.notFound.description);
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
    detailSection,
  };
}

export async function loadTeacherDetailPage({
  locals,
  params,
  request,
}: {
  locals: App.Locals;
  params: { id: string; section?: string };
  request: Request;
}) {
  const copy = getTeacherDetailCopy(locals.locale);
  const detailSection = resolveCatalogDetailRouteSection(params.section);
  if (!detailSection) error(404, copy.notFound.description);
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
    detailSection,
  };
}
