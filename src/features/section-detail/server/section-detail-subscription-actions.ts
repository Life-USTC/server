import { fail, redirect } from "@sveltejs/kit";
import type { AppLocale } from "@/i18n/config";
import { getSectionDetailPageCopy } from "./section-detail-page-copy";
import { parseSectionJwId } from "./section-detail-params";

async function updateSectionSubscription({
  action,
  locals,
  params,
}: {
  action: "subscribe" | "unsubscribe";
  locals: { authUser: App.Locals["authUser"]; locale: AppLocale };
  params: { jwId: string };
  request: Request;
}) {
  const copy = getSectionDetailPageCopy(locals.locale).sectionDetail;
  const userId = locals.authUser?.id ?? null;
  if (!userId) return fail(401, { error: copy.loginRequired });
  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null) return fail(400, { error: copy.operationFailed });
  const subscriptions = await import(
    "@/features/subscriptions/server/subscriptions"
  );
  const result =
    action === "subscribe"
      ? await subscriptions.subscribeUserToSectionByJwId(userId, jwId)
      : await subscriptions.unsubscribeUserFromSectionByJwId(userId, jwId);
  if (!result) return fail(404, { error: copy.operationFailed });
  throw redirect(303, `/sections/${jwId}`);
}

export function subscribeSectionAction(input: {
  locals: { authUser: App.Locals["authUser"]; locale: AppLocale };
  params: { jwId: string };
  request: Request;
}) {
  return updateSectionSubscription({ ...input, action: "subscribe" });
}

export function unsubscribeSectionAction(input: {
  locals: { authUser: App.Locals["authUser"]; locale: AppLocale };
  params: { jwId: string };
  request: Request;
}) {
  return updateSectionSubscription({ ...input, action: "unsubscribe" });
}
