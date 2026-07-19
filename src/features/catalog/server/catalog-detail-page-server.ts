import { error, redirect } from "@sveltejs/kit";
import { catalogPrimaryName } from "@/features/catalog/lib/catalog-list-display";
import {
  buildCourseStructuredData,
  buildTeacherStructuredData,
  serializeStructuredData,
} from "@/features/catalog/lib/catalog-structured-data";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import { getViewerContext } from "@/lib/auth/viewer-context";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
} from "@/lib/social-metadata";
import { loadCatalogDetailCommentsData } from "./catalog-detail-comments";
import {
  getCourseDetailCopy,
  getTeacherDetailCopy,
} from "./catalog-detail-copy";

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
  const [course, viewer] = await Promise.all([
    getCoursePage(jwId, locals.locale),
    getViewerContext({ userId: locals.authUser?.id ?? null }),
  ]);
  if (!course) error(404, copy.notFound.description);
  if (course.jwId !== jwId) {
    const sectionPath = detailSection === "overview" ? "" : `/${detailSection}`;
    redirect(308, `/courses/${course.jwId}${sectionPath}${url.search}`);
  }
  const displayName = catalogPrimaryName(course) || course.code;
  const { commentsData, descriptionData } = await loadCatalogDetailCommentsData(
    {
      includeComments: detailSection === "comments",
      targetId: course.id,
      type: "course",
      viewer,
    },
  );
  const socialMetadata = buildSocialMetadata({
    canonicalPath: `/courses/${course.jwId}`,
    description: formatSocialMetadataMessage(
      copy.metadata.social.courseDescription,
      { code: course.code, name: displayName },
    ),
    imageAlt: copy.metadata.social.imageAlt,
    locale: locals.locale,
    origin: url.origin,
    title: `${displayName} (${course.code}) - Life@USTC`,
  });
  return {
    course,
    locale: locals.locale,
    copy,
    descriptionData,
    commentsData,
    detailSection,
    socialMetadata,
    structuredDataJson: serializeStructuredData(
      buildCourseStructuredData({
        canonicalUrl: socialMetadata.canonicalUrl,
        code: course.code,
        description: descriptionData.description.content,
        labels: {
          collection: copy.common.courses,
          home: copy.common.home,
        },
        name: displayName,
      }),
    ),
  };
}

export async function loadTeacherDetailPage({
  locals,
  params,
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
  const [teacher, viewer] = await Promise.all([
    getTeacherPage(id, locals.locale),
    getViewerContext({ userId: locals.authUser?.id ?? null }),
  ]);
  if (!teacher) error(404, copy.notFound.description);
  const displayName = catalogPrimaryName(teacher);
  const { commentsData, descriptionData } = await loadCatalogDetailCommentsData(
    {
      includeComments: detailSection === "comments",
      targetId: teacher.id,
      type: "teacher",
      viewer,
    },
  );
  const socialMetadata = buildSocialMetadata({
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
  });
  return {
    teacher,
    locale: locals.locale,
    copy,
    descriptionData,
    commentsData,
    detailSection,
    socialMetadata,
    structuredDataJson: serializeStructuredData(
      buildTeacherStructuredData({
        canonicalUrl: socialMetadata.canonicalUrl,
        labels: {
          collection: copy.common.teachers,
          home: copy.common.home,
        },
        name: displayName,
      }),
    ),
  };
}
