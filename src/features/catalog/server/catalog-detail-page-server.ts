import { error } from "@sveltejs/kit";
import { catalogPrimaryName } from "@/features/catalog/lib/catalog-list-display";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
} from "@/lib/social-metadata";
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
  url,
}: {
  locals: App.Locals;
  params: { jwId: string; section?: string };
  request: Request;
  url: URL;
}) {
  const copy = getCourseDetailCopy(locals.locale);
  const detailSection = resolveCatalogDetailRouteSection(params.section);
  if (!detailSection) error(404, copy.notFound.description);
  const jwId = Number(params.jwId);
  if (!Number.isInteger(jwId)) error(404, copy.notFound.description);
  const course = await getCoursePage(jwId, locals.locale);
  if (!course) error(404, copy.notFound.description);
  const displayName = catalogPrimaryName(course) || course.code;
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
    socialMetadata: buildSocialMetadata({
      canonicalPath: `/courses/${course.jwId}`,
      description: formatSocialMetadataMessage(
        copy.metadata.social.courseDescription,
        { code: course.code, name: displayName },
      ),
      imageAlt: copy.metadata.social.imageAlt,
      locale: locals.locale,
      origin: url.origin,
      title: `${displayName} (${course.code}) - Life@USTC`,
    }),
  };
}

export async function loadTeacherDetailPage({
  locals,
  params,
  request,
  url,
}: {
  locals: App.Locals;
  params: { id: string; section?: string };
  request: Request;
  url: URL;
}) {
  const copy = getTeacherDetailCopy(locals.locale);
  const detailSection = resolveCatalogDetailRouteSection(params.section);
  if (!detailSection) error(404, copy.notFound.description);
  const id = Number(params.id);
  if (!Number.isInteger(id)) error(404, copy.notFound.description);
  const teacher = await getTeacherPage(id, locals.locale);
  if (!teacher) error(404, copy.notFound.description);
  const displayName = catalogPrimaryName(teacher);
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
    socialMetadata: buildSocialMetadata({
      canonicalPath: `/teachers/${teacher.id}`,
      description: formatSocialMetadataMessage(
        copy.metadata.social.teacherDescription,
        { name: displayName },
      ),
      imageAlt: copy.metadata.social.imageAlt,
      locale: locals.locale,
      origin: url.origin,
      title: `${formatSocialMetadataMessage(copy.metadata.pages.teacherDetail, {
        name: displayName,
      })} - Life@USTC`,
    }),
  };
}
