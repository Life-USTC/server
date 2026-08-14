import { error, redirect } from "@sveltejs/kit";
import {
  buildSectionStructuredData,
  serializeStructuredData,
} from "@/features/catalog/lib/catalog-structured-data";
import {
  formatMessage,
  primaryName,
} from "@/features/section-detail/lib/display";
import { resolveSectionDetailTabQueryRedirect } from "@/features/section-detail/lib/section-detail-tab";
import { getSectionPage } from "@/features/section-detail/server/section-page-data";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { getViewerContext } from "@/lib/auth/viewer-context";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
} from "@/lib/social-metadata";
import { requireCampusDateKeyForValue } from "@/lib/time/campus-date";
import { getSectionDetailPageCopy } from "./section-detail-page-copy";
import { parseSectionJwId } from "./section-detail-params";

export {
  subscribeSectionAction,
  unsubscribeSectionAction,
} from "./section-detail-subscription-actions";

type SectionDetailPageInput = {
  locals: App.Locals;
  params: { jwId: string; section?: string };
  request: Request;
  url: URL;
};

async function loadSectionDetailPageData({
  locals,
  params,
  request,
  url,
}: SectionDetailPageInput) {
  const tabQueryRedirect = resolveSectionDetailTabQueryRedirect(request);
  if (tabQueryRedirect) {
    redirect(308, tabQueryRedirect);
  }

  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null) error(404, "Section not found");
  const userId = locals.authUser?.id ?? null;
  // Stream layout always renders calendar/exams/teachers in-page, so expand
  // those payloads on first load (including PublicSsr anonymous).
  const focusedHomeworkId = url.searchParams.get("homeworkId");
  const shouldLoadHomework = Boolean(userId) || focusedHomeworkId != null;
  const subscriptionStatePromise = userId
    ? import("@/features/subscriptions/server/subscriptions").then(
        ({ getUserSectionSubscriptionState }) =>
          getUserSectionSubscriptionState(userId),
      )
    : Promise.resolve(null);
  const [pageData, viewer, subscriptionState] = await Promise.all([
    runCloudflareTraceSpan(
      "catalog.detail.core",
      { "catalog.detail.kind": "section" },
      () =>
        getSectionPage(jwId, locals.locale, {
          includeExams: true,
          includeRelated: true,
          includeSchedules: true,
          includeTeacherDepartments: true,
        }),
    ),
    runCloudflareTraceSpan(
      "catalog.detail.viewer",
      {
        "catalog.detail.kind": "section",
        "user.authenticated": Boolean(userId),
      },
      () => getViewerContext({ userId }),
    ),
    subscriptionStatePromise,
  ]);
  if (!pageData) error(404, "Section not found");
  const { description, section } = pageData;
  const copy = getSectionDetailPageCopy(locals.locale);
  const courseName = primaryName(section.course) || section.code;
  const homeworkData = shouldLoadHomework
    ? await (
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
      };
  const descriptionData = { description, history: [], viewer };
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
    descriptionData,
    commentsData: null,
    detailSection: "overview" as const,
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
        description: descriptionData.description.content,
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

export function loadSectionDetailPage(input: SectionDetailPageInput) {
  return runCloudflareTraceSpan(
    "catalog.detail.data_load",
    { "catalog.detail.kind": "section" },
    () => loadSectionDetailPageData(input),
  );
}
