import { error } from "@sveltejs/kit";
import {
  formatMessage,
  primaryName,
} from "@/features/section-detail/lib/display";
import { getSectionPage } from "@/features/section-detail/server/section-page-data";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
} from "@/lib/social-metadata";
import { requireCampusDateKeyForValue } from "@/lib/time/campus-date";
import { getSectionDetailDescriptionAndComments } from "./section-detail-comments-data";
import { getSectionHomeworkData } from "./section-detail-homework-data";
import { getSectionDetailPageCopy } from "./section-detail-page-copy";
import { parseSectionJwId } from "./section-detail-params";
import { getSectionDetailUserId } from "./section-detail-session";

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
  request,
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
  const section = await getSectionPage(jwId, locals.locale);
  if (!section) error(404, "Section not found");
  const copy = getSectionDetailPageCopy(locals.locale);
  const courseName = primaryName(section.course) || section.code;
  const userId = await getSectionDetailUserId(request);
  const [subscriptionState, descriptionAndComments, homeworkData] =
    await Promise.all([
      userId
        ? (
            await import("@/features/subscriptions/server/subscriptions")
          ).getUserSectionSubscriptionState(userId)
        : null,
      getSectionDetailDescriptionAndComments(section, userId),
      getSectionHomeworkData(section.id, userId),
    ]);
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
    socialMetadata: buildSocialMetadata({
      canonicalPath: `/sections/${jwId}`,
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
    }),
    viewer: {
      signedIn: Boolean(userId),
      isSubscribed: Boolean(
        subscriptionState?.subscribedSections.includes(section.id),
      ),
      subscriptionIcsUrl: subscriptionState?.subscriptionIcsUrl ?? null,
    },
  };
}
