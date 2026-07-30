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
  buildPublicDetailRuntimeCacheOptions,
  PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS,
} from "@/lib/catalog-detail-runtime-cache";
import {
  cachedPublicRuntimeData,
  publicDetailColoCacheKey,
} from "@/lib/public-runtime-cache";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isPublicCourseCore(value: unknown, jwId: number) {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    value.jwId === jwId &&
    typeof value.code === "string" &&
    typeof value.namePrimary === "string" &&
    typeof value.sectionCount === "number" &&
    Array.isArray(value.sections) &&
    value.sections.length === 0
  );
}

function isPublicTeacherCore(value: unknown, id: number) {
  return (
    isRecord(value) &&
    value.id === id &&
    typeof value.namePrimary === "string" &&
    typeof value.sectionCount === "number" &&
    Array.isArray(value.sections) &&
    value.sections.length === 0
  );
}

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
  const includeSections = detailSection === "sections";
  const loadCourse = () =>
    getCoursePage(jwId, locals.locale, { includeSections });
  const courseCacheOptions =
    locals.publicSsr && !locals.authUser && !includeSections
      ? await buildPublicDetailRuntimeCacheOptions({
          coloCacheKey: publicDetailColoCacheKey(
            url.origin,
            "course",
            locals.locale,
            jwId,
          ),
          id: jwId,
          kind: "course",
          kvShape: "core-without-sections",
          locale: locals.locale,
          shouldCacheResult: (result) => result !== null,
          validateColoCacheResult: (result) => isPublicCourseCore(result, jwId),
        })
      : null;
  const [course, viewer] = await Promise.all([
    courseCacheOptions
      ? cachedPublicRuntimeData(
          `page:course-detail:${locals.locale}`,
          `catalog-detail:course:${locals.locale}:${jwId}`,
          PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS,
          loadCourse,
          courseCacheOptions,
        )
      : loadCourse(),
    getViewerContext({ userId: locals.authUser?.id ?? null }),
  ]);
  if (!course) error(404, copy.notFound.description);
  if (course.jwId !== jwId) {
    const sectionPath = detailSection === "overview" ? "" : `/${detailSection}`;
    redirect(308, `/catalog/courses/${course.jwId}${sectionPath}${url.search}`);
  }
  const displayName = catalogPrimaryName(course) || course.code;
  const includeDescription =
    detailSection === "introduction" || detailSection === "overview";
  const { commentsData, descriptionData } = await loadCatalogDetailCommentsData(
    {
      includeComments: detailSection === "comments",
      includeDescription,
      includeDescriptionHistory: detailSection === "introduction",
      targetId: course.id,
      type: "course",
      viewer,
    },
  );
  const socialMetadata = buildSocialMetadata({
    card: {
      footer: `Life@USTC · ${copy.common.courses}`,
      label: locals.locale === "zh-cn" ? "COURSE · 课程" : "COURSE",
      subtitle: `${course.code} · ${copy.common.sections}`,
      title: displayName,
      variant: "course",
    },
    canonicalPath: `/catalog/courses/${course.jwId}`,
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
  const includeSections = detailSection === "sections";
  const loadTeacher = () =>
    getTeacherPage(id, locals.locale, { includeSections });
  const teacherCacheOptions =
    locals.publicSsr && !locals.authUser && !includeSections
      ? await buildPublicDetailRuntimeCacheOptions({
          coloCacheKey: publicDetailColoCacheKey(
            url.origin,
            "teacher",
            locals.locale,
            id,
          ),
          id,
          kind: "teacher",
          kvShape: "core-without-sections",
          locale: locals.locale,
          shouldCacheResult: (result) => result !== null,
          validateColoCacheResult: (result) => isPublicTeacherCore(result, id),
        })
      : null;
  const [teacher, viewer] = await Promise.all([
    teacherCacheOptions
      ? cachedPublicRuntimeData(
          `page:teacher-detail:${locals.locale}`,
          `catalog-detail:teacher:${locals.locale}:${id}`,
          PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS,
          loadTeacher,
          teacherCacheOptions,
        )
      : loadTeacher(),
    getViewerContext({ userId: locals.authUser?.id ?? null }),
  ]);
  if (!teacher) error(404, copy.notFound.description);
  const displayName = catalogPrimaryName(teacher);
  const includeDescription =
    detailSection === "introduction" || detailSection === "overview";
  const { commentsData, descriptionData } = await loadCatalogDetailCommentsData(
    {
      includeComments: detailSection === "comments",
      includeDescription,
      includeDescriptionHistory: detailSection === "introduction",
      targetId: teacher.id,
      type: "teacher",
      viewer,
    },
  );
  const socialMetadata = buildSocialMetadata({
    card: {
      footer: `Life@USTC · ${copy.common.teachers}`,
      label: locals.locale === "zh-cn" ? "TEACHER · 教师" : "TEACHER",
      subtitle: formatSocialMetadataMessage(
        copy.metadata.social.teacherDescription,
        { name: displayName },
      ),
      title: displayName,
      variant: "teacher",
    },
    canonicalPath: `/catalog/teachers/${teacher.id}`,
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
