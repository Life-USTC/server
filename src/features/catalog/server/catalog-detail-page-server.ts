import { error, redirect } from "@sveltejs/kit";
import {
  type CatalogDetailTab,
  resolveCatalogDetailTabQueryRedirect,
} from "@/features/catalog/lib/catalog-detail-tab";
import { catalogPrimaryName } from "@/features/catalog/lib/catalog-list-display";
import {
  buildCourseStructuredData,
  buildTeacherStructuredData,
  serializeStructuredData,
} from "@/features/catalog/lib/catalog-structured-data";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
} from "@/lib/social-metadata";
import { loadCatalogDetailCommentsData } from "./catalog-detail-comments";
import {
  getCourseDetailCopy,
  getTeacherDetailCopy,
} from "./catalog-detail-copy";

export type CourseDetailRouteSection = CatalogDetailTab;
export type TeacherDetailRouteSection = CatalogDetailTab;

type CourseDetailPageInput = {
  locals: App.Locals;
  params: { jwId: string; section?: string };
  request: Request;
  url: URL;
};

type TeacherDetailPageInput = {
  locals: App.Locals;
  params: { id: string; section?: string };
  request: Request;
  url: URL;
};

async function loadCourseDetailPageData({
  locals,
  params,
  request,
  url,
}: CourseDetailPageInput) {
  const tabQueryRedirect = resolveCatalogDetailTabQueryRedirect(
    request,
    "courses",
  );
  if (tabQueryRedirect) {
    redirect(308, tabQueryRedirect);
  }

  const copy = getCourseDetailCopy(locals.locale);
  const jwId = Number(params.jwId);
  if (!Number.isInteger(jwId)) error(404, copy.notFound.description);
  // Stream layout always shows the sections table; include on first load.
  const [course, viewer] = await Promise.all([
    runCloudflareTraceSpan(
      "catalog.detail.core",
      { "catalog.detail.kind": "course" },
      () => getCoursePage(jwId, locals.locale),
    ),
    runCloudflareTraceSpan(
      "catalog.detail.viewer",
      {
        "catalog.detail.kind": "course",
        "user.authenticated": Boolean(locals.authUser?.id),
      },
      () => getViewerContext({ userId: locals.authUser?.id ?? null }),
    ),
  ]);
  if (!course) error(404, copy.notFound.description);
  if (course.jwId !== jwId) {
    const redirectUrl = new URL(`/catalog/courses/${course.jwId}`, url.origin);
    for (const [key, value] of url.searchParams) {
      if (key === "tab") continue;
      redirectUrl.searchParams.append(key, value);
    }
    redirect(308, `${redirectUrl.pathname}${redirectUrl.search}`);
  }
  const displayName = catalogPrimaryName(course) || course.code;
  const { commentsData, descriptionData } = await runCloudflareTraceSpan(
    "catalog.detail.comments",
    { "catalog.detail.kind": "course" },
    () =>
      loadCatalogDetailCommentsData({
        includeDescription: true,
        includeDescriptionHistory: false,
        targetId: course.id,
        type: "course",
        viewer,
      }),
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
    detailSection: "overview" as const,
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

export function loadCourseDetailPage(input: CourseDetailPageInput) {
  return runCloudflareTraceSpan(
    "catalog.detail.data_load",
    { "catalog.detail.kind": "course" },
    () => loadCourseDetailPageData(input),
  );
}

async function loadTeacherDetailPageData({
  locals,
  params,
  request,
  url,
}: TeacherDetailPageInput) {
  const tabQueryRedirect = resolveCatalogDetailTabQueryRedirect(
    request,
    "teachers",
  );
  if (tabQueryRedirect) {
    redirect(308, tabQueryRedirect);
  }

  const copy = getTeacherDetailCopy(locals.locale);
  const id = Number(params.id);
  if (!Number.isInteger(id)) error(404, copy.notFound.description);
  // Stream layout always shows teaching sections; include on first load.
  const [teacher, viewer] = await Promise.all([
    runCloudflareTraceSpan(
      "catalog.detail.core",
      { "catalog.detail.kind": "teacher" },
      () => getTeacherPage(id, locals.locale),
    ),
    runCloudflareTraceSpan(
      "catalog.detail.viewer",
      {
        "catalog.detail.kind": "teacher",
        "user.authenticated": Boolean(locals.authUser?.id),
      },
      () => getViewerContext({ userId: locals.authUser?.id ?? null }),
    ),
  ]);
  if (!teacher) error(404, copy.notFound.description);
  const displayName = catalogPrimaryName(teacher);
  const { commentsData, descriptionData } = await runCloudflareTraceSpan(
    "catalog.detail.comments",
    { "catalog.detail.kind": "teacher" },
    () =>
      loadCatalogDetailCommentsData({
        includeDescription: true,
        includeDescriptionHistory: false,
        targetId: teacher.id,
        type: "teacher",
        viewer,
      }),
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
    detailSection: "overview" as const,
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

export function loadTeacherDetailPage(input: TeacherDetailPageInput) {
  return runCloudflareTraceSpan(
    "catalog.detail.data_load",
    { "catalog.detail.kind": "teacher" },
    () => loadTeacherDetailPageData(input),
  );
}
