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
  getSectionPage,
  withSectionPageRelatedData,
} from "@/features/section-detail/server/section-page-data";
import {
  cachedPublicRuntimeData,
  publicDetailColoCacheKey,
} from "@/lib/public-runtime-cache";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
} from "@/lib/social-metadata";
import { requireCampusDateKeyForValue } from "@/lib/time/campus-date";
import { getSectionDetailDescriptionAndComments } from "./section-detail-comments-data";
import { getSectionHomeworkData } from "./section-detail-homework-data";
import { getSectionDetailPageCopy } from "./section-detail-page-copy";
import { parseSectionJwId } from "./section-detail-params";

export {
  subscribeSectionAction,
  unsubscribeSectionAction,
} from "./section-detail-subscription-actions";

export type SectionDetailRouteSection =
  | "overview"
  | "introduction"
  | "calendar"
  | "exams"
  | "homework"
  | "teachers"
  | "comments";

const sectionDetailRouteSections = new Set([
  "introduction",
  "calendar",
  "exams",
  "homework",
  "teachers",
  "comments",
]);

const PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function isPublicSectionCore(value: unknown, jwId: number) {
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
    isEmptyArray(value.sameSemesterOtherTeachers) &&
    isEmptyArray(value.sameTeacherOtherSemesters)
  );
}

function resolveSectionDetailRouteSection(
  section: string | undefined,
): SectionDetailRouteSection | null {
  if (!section) return "overview";
  return sectionDetailRouteSections.has(section)
    ? (section as SectionDetailRouteSection)
    : null;
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
  const detailSection = resolveSectionDetailRouteSection(params.section);
  if (!detailSection) error(404, "Section not found");
  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null) error(404, "Section not found");
  const userId = locals.authUser?.id ?? null;
  const includeExams =
    detailSection === "calendar" || detailSection === "exams";
  const includeRelated = detailSection === "overview";
  const includeSchedules = detailSection === "calendar";
  const cachePublicCore =
    locals.publicSsr && !userId && !includeExams && !includeSchedules;
  const loadSection = () =>
    getSectionPage(jwId, locals.locale, {
      includeExams,
      includeRelated: cachePublicCore ? false : includeRelated,
      includeSchedules,
    });
  const sectionCore = cachePublicCore
    ? await cachedPublicRuntimeData(
        `page:section-detail:${locals.locale}`,
        `catalog-detail:section:${locals.locale}:${jwId}`,
        PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS,
        loadSection,
        {
          coloCacheKey: publicDetailColoCacheKey(
            url.origin,
            "section",
            locals.locale,
            jwId,
          ),
          shouldCacheResult: (result) => result !== null,
          validateColoCacheResult: (result) =>
            isPublicSectionCore(result, jwId),
        },
      )
    : await loadSection();
  if (!sectionCore) error(404, "Section not found");
  const section =
    cachePublicCore && includeRelated
      ? await withSectionPageRelatedData(sectionCore, locals.locale)
      : sectionCore;
  const copy = getSectionDetailPageCopy(locals.locale);
  const courseName = primaryName(section.course) || section.code;
  const [subscriptionState, descriptionAndComments, homeworkData] =
    await Promise.all([
      userId
        ? (
            await import("@/features/subscriptions/server/subscriptions")
          ).getUserSectionSubscriptionState(userId)
        : null,
      getSectionDetailDescriptionAndComments(section, userId, {
        includeComments: detailSection === "comments",
        includeDescriptionHistory: detailSection === "introduction",
      }),
      detailSection === "homework"
        ? getSectionHomeworkData(section.id, userId)
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
    commentsData: descriptionAndComments.commentsData,
    detailSection,
    homeworkData,
    focusedHomeworkId: url.searchParams.get("homeworkId"),
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
