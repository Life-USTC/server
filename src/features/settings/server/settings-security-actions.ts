import { fail, redirect } from "@sveltejs/kit";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import type { SettingsActionInput } from "@/features/settings/server/settings-page-common";
import { requireSettingsUser } from "@/features/settings/server/settings-page-data";
import { rotateUserCalendarFeedToken } from "@/features/subscriptions/server/calendar-feed-token";
import { logServerActionError } from "@/lib/log/app-logger";

export async function rotateSettingsCalendarTokenAction({
  locale,
  request,
  requestId,
  url,
}: SettingsActionInput & { requestId: string }) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  try {
    const result = await rotateUserCalendarFeedToken(user.id, request.headers);
    if (!result.ok) {
      return fail(403, {
        kind: "security",
        message: copy.settings.recentAuthRequired,
      });
    }
  } catch (error) {
    logServerActionError("settings.calendar-token.rotate.failed", error, {
      action: "rotate-calendar-token",
      requestId,
      route: "/account/settings/security",
    });
    return fail(500, {
      kind: "security",
      message: copy.settings.security.calendarTokenError,
    });
  }
  throw redirect(
    303,
    "/account/settings/security?message=CalendarTokenRotated",
  );
}
