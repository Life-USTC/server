import type { AppPageCopy } from "@/lib/shell/page-copy";

type NotificationCopy = AppPageCopy["youngEvents"]["workspace"];

/** Localize fixed text in the notification service's current format; preserve event names. */
export function youngNotificationDescription(
  notification: { kind: string; body: string },
  copy: NotificationCopy,
): string {
  if (notification.kind === "organizer_digest") {
    return notification.body.replace(
      /^(\d+) 个新活动 \/ new events: /,
      (_prefix, count: string) => copy.digestPrefix.replace("{count}", count),
    );
  }
  if (
    notification.kind === "event_changed" &&
    notification.body ===
      "来源暂缺，请核实校方信息 / Source unavailable; check the official event page."
  ) {
    return copy.sourceUnavailableDescription;
  }
  return (
    copy.notificationDescriptions[
      notification.kind as keyof typeof copy.notificationDescriptions
    ] ?? copy.notificationsHint
  );
}
