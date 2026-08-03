import { error } from "@sveltejs/kit";
import {
  buildSectionStructuredData,
  serializeStructuredData,
} from "@/features/catalog/lib/catalog-structured-data";
import {
  formatMessage,
  primaryName,
} from "@/features/section-detail/lib/display";
import {
  parseSectionDetailTab,
  SECTION_DETAIL_TAB_QUERY,
  type SectionDetailTab,
} from "@/features/section-detail/lib/section-detail-tab";
import { getSectionPage } from "@/features/section-detail/server/section-page-data";
import type { AppLocale } from "@/i18n/config";
import {
  buildPublicDetailRuntimeCacheOptions,
  PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS,
} from "@/lib/catalog-detail-runtime-cache";
import { cachedPublicRuntimeData } from "@/lib/public-runtime-cache";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
} from "@/lib/social-metadata";
import { requireCampusDateKeyForValue } from "@/lib/time/campus-date";
import { getSectionDetailDescriptionAndComments } from "./section-detail-comments-data";
import { getSectionDetailPageCopy } from "./section-detail-page-copy";
import { parseSectionJwId } from "./section-detail-params";

export {
  subscribeSectionAction,
  unsubscribeSectionAction,
} from "./section-detail-subscription-actions";

export type SectionDetailRouteSection = SectionDetailTab;

const PUBLIC_DETAIL_COLO_CACHE_PATH =
  "/_life-ustc-internal-cache/catalog-detail-core/v1";

function publicSectionOverviewColoCacheKey(
  origin: string,
  locale: AppLocale,
  jwId: number,
) {
  return new URL(
    `${PUBLIC_DETAIL_COLO_CACHE_PATH}/section/core-with-related-overview/${locale}/${encodeURIComponent(String(jwId))}`,
    origin,
  ).toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function isPublicSectionOverviewCore(value: unknown, jwId: number) {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    value.jwId === jwId &&
    typeof value.code === "string" &&
    typeof value.courseId === "number" &&
    (value.semesterId === null || typeof value.semesterId === "number") &&
    isRecord(value.course) &&
    typeof value.course.id === "number" &&
    typeof value.course.jwId === "number" &&
    typeof value.course.namePrimary === "string" &&
    Array.isArray(value.adminClasses) &&
    Array.isArray(value.teachers) &&
    value.teachers.every(
      (teacher) => isRecord(teacher) && typeof teacher.id === "number",
    ) &&
    typeof value.examCount === "number" &&
    typeof value.scheduleCount === "number" &&
    isEmptyArray(value.exams) &&
    isEmptyArray(value.schedules) &&
    Array.isArray(value.sameSemesterOtherTeachers) &&
    Array.isArray(value.sameTeacherOtherSemesters)
  );
}

export async function loadSectionDetailPage({
  locals,
  params,
  url,
}: {
  locals: App.Locals;
  params: { jwId: string; section?: string };
  request: Request;
  url: URL;
}) {
  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null) error(404, "Section not found");
  const initialTab = parseSectionDetailTab(
    params.section ?? url.searchParams.get(SECTION_DETAIL_TAB_QUERY),
  );
  const userId = locals.authUser?.id ?? null;
  const includeSchedules = initialTab === "calendar";
  const includeExams = initialTab === "calendar" || initialTab === "exams";
  const includeTeacherDepartments = initialTab === "teachers";
  const includeRelated = initialTab === "overview";
  const focusedHomeworkId = url.searchParams.get("homeworkId");
  const shouldLoadHomework =
    initialTab === "homework" || focusedHomeworkId != null;
  const cachePublicCore =
    locals.publicSsr &&
    !userId &&
    !includeExams &&
    !includeSchedules &&
    !includeTeacherDepartments &&
    !shouldLoadHomework;
  const loadSection = () =>
    getSectionPage(jwId, locals.locale, {
      includeExams,
      includeRelated,
      includeSchedules,
      includeTeacherDepartments,
    });
  const section = cachePublicCore
    ? await cachedPublicRuntimeData(
        `page:section-detail:overview:${locals.locale}`,
        `catalog-detail:section:overview:${locals.locale}:${jwId}`,
        PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS,
        loadSection,
        await buildPublicDetailRuntimeCacheOptions({
          coloCacheKey: publicSectionOverviewColoCacheKey(
            url.origin,
            locals.locale,
            jwId,
          ),
          id: jwId,
          kind: "section",
          kvShape: "core-with-related-overview",
          locale: locals.locale,
          shouldCacheResult: (result) => result !== null,
          validateColoCacheResult: (result) =>
            isPublicSectionOverviewCore(result, jwId),
        }),
      )
    : await loadSection();
  if (!section) error(404, "Section not found");
  const copy = getSectionDetailPageCopy(locals.locale);
  const courseName = primaryName(section.course) || section.code;
  const includeDescription =
    initialTab === "introduction" || initialTab === "overview";
  const [subscriptionState, descriptionAndComments, homeworkData] =
    await Promise.all([
      userId
        ? (
            await import("@/features/subscriptions/server/subscriptions")
          ).getUserSectionSubscriptionState(userId)
        : null,
      getSectionDetailDescriptionAndComments(section, userId, {
        includeDescription,
        includeDescriptionHistory: false,
      }),
      shouldLoadHomework
        ? (
            await import("./section-detail-homework-data")
          ).getSectionHomeworkData(section.id, userId)
        : {
            auditLogs: [],
            homeworks: [],
            viewer: {
              isAdmin: false,
              isAuthenticated: Boolean(userId),
              isSuspended: false,
              userId,
            },
          },
    ]);
  const socialMetadata = buildSocialMetadata({
    card: {
      footer: `Life@USTC · ${copy.common.sections}`,
      label: locals.locale === "zh-cn" ? "SECTION · 教学班" : "SECTION",
      subtitle: section.code,
      title: courseName,
      variant: "section",
    },
    canonicalPath: `/catalog/sections/${jwId}`,
    description: formatSocialMetadataMessage(
      copy.metadata.social.sectionDescription,
      { code: section.code, name: courseName },
    ),
    imageAlt: copy.metadata.social.imageAlt,
    locale: locals.locale,
    origin: url.origin,
    title: `${formatMessage(copy.metadata.pages.sectionDetail, {
      code: section.code,
      name: courseName,
    })} - Life@USTC`,
  });
  const sectionName = formatMessage(copy.metadata.pages.sectionDetail, {
    code: section.code,
    name: courseName,
  });
  return {
    section,
    locale: locals.locale,
    todayCalendarKey: requireCampusDateKeyForValue(new Date()),
    copy,
    descriptionData: descriptionAndComments.descriptionData,
    commentsData: null,
    detailSection: initialTab,
    homeworkData,
    focusedHomeworkId,
    homeworkView:
      url.searchParams.get("homeworkView") === "list" ? "list" : "cards",
    showSubscribeDialog:
      section.retiredAt === null && url.searchParams.get("subscribe") === "1",
    socialMetadata,
    structuredDataJson: serializeStructuredData(
      buildSectionStructuredData({
        canonicalUrl: socialMetadata.canonicalUrl,
        course: {
          jwId: section.course.jwId,
          name: courseName,
        },
        description: descriptionAndComments.descriptionData.description.content,
        instructors: section.teachers.map((teacher) => ({
          id: teacher.id,
          name: primaryName(teacher),
        })),
        labels: {
          collection: copy.common.sections,
          home: copy.common.home,
        },
        name: sectionName,
      }),
    ),
    viewer: {
      signedIn: Boolean(userId),
      isSubscribed: Boolean(
        subscriptionState?.subscribedSections.includes(section.id),
      ),
      subscriptionIcsUrl: subscriptionState?.subscriptionIcsUrl ?? null,
    },
  };
}
