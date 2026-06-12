import { redirect } from "@sveltejs/kit";
import { getSectionDetailPageCopy } from "./section-detail-page-copy";
import { parseSectionJwId } from "./section-detail-params";
import { getSectionDetailUserId } from "./section-detail-session";

async function updateSectionSubscription({
  action,
  locals,
  params,
  request,
}: {
  action: "subscribe" | "unsubscribe";
  locals: App.Locals;
  params: { jwId: string };
  request: Request;
}) {
  const copy = getSectionDetailPageCopy(locals.locale).sectionDetail;
  const userId = await getSectionDetailUserId(request);
  if (!userId) return { error: copy.loginRequired };
  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null) return { error: copy.operationFailed };
  const subscriptions = await import("@/features/home/server/subscriptions");
  if (action === "subscribe") {
    await subscriptions.subscribeUserToSectionByJwId(userId, jwId);
  } else {
    await subscriptions.unsubscribeUserFromSectionByJwId(userId, jwId);
  }
  throw redirect(303, `/sections/${jwId}`);
}

export function subscribeSectionAction(input: {
  locals: App.Locals;
  params: { jwId: string };
  request: Request;
}) {
  return updateSectionSubscription({ ...input, action: "subscribe" });
}

export function unsubscribeSectionAction(input: {
  locals: App.Locals;
  params: { jwId: string };
  request: Request;
}) {
  return updateSectionSubscription({ ...input, action: "unsubscribe" });
}
