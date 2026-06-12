import { error } from "@sveltejs/kit";
import { getSectionPage } from "@/lib/page-data";
import { getSectionDetailDescriptionAndComments } from "./section-detail-comments-data";
import { getSectionHomeworkData } from "./section-detail-homework-data";
import {
  getSectionDetailPageCopy,
  normalizeSectionDetailTab,
} from "./section-detail-page-copy";
import { parseSectionJwId } from "./section-detail-params";
import { getSectionDetailUserId } from "./section-detail-session";

export {
  subscribeSectionAction,
  unsubscribeSectionAction,
} from "./section-detail-subscription-actions";

export async function loadSectionDetailPage({
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
  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null) error(404, "Section not found");
  const section = await getSectionPage(jwId, locals.locale);
  if (!section) error(404, "Section not found");
  const userId = await getSectionDetailUserId(request);
  const [subscriptionState, descriptionAndComments, homeworkData] =
    await Promise.all([
      userId
        ? (
            await import("@/features/home/server/subscriptions")
          ).getUserSectionSubscriptionState(userId)
        : null,
      getSectionDetailDescriptionAndComments(section, userId),
      getSectionHomeworkData(section.id, userId),
    ]);
  return {
    section,
    locale: locals.locale,
    copy: getSectionDetailPageCopy(locals.locale),
    descriptionData: descriptionAndComments.descriptionData,
    commentsData: descriptionAndComments.commentsData,
    homeworkData,
    tab: normalizeSectionDetailTab(url.searchParams.get("tab")),
    homeworkView:
      url.searchParams.get("homeworkView") === "list" ? "list" : "cards",
    showSubscribeDialog: url.searchParams.get("subscribe") === "1",
    viewer: {
      signedIn: Boolean(userId),
      isSubscribed: Boolean(
        subscriptionState?.subscribedSections.includes(section.id),
      ),
      subscriptionIcsUrl: subscriptionState?.subscriptionIcsUrl ?? null,
    },
  };
}
