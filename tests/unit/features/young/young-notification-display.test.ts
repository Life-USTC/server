import { describe, expect, it } from "vitest";
import { youngNotificationDescription } from "@/features/young/lib/young-notification-display";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";

for (const locale of ["zh-cn", "en-us"] as const) {
  describe(`notification display in ${locale}`, () => {
    const copy = getWorkspacePageCopy(locale).youngEvents.workspace;
    it("preserves digest counts, activity names and the additional-results marker", () => {
      const names = "学术交流 · Film night / 导演分享 · new events: Workshop …";
      const text = youngNotificationDescription(
        {
          kind: "organizer_digest",
          body: `11 个新活动 / new events: ${names}`,
        },
        copy,
      );
      expect(text).toBe(
        `${locale === "zh-cn" ? "11 个新活动：" : "11 new activities: "}${names}`,
      );
    });
    it("keeps a missing source distinct from ordinary activity updates", () => {
      const missing = youngNotificationDescription(
        {
          kind: "event_changed",
          body: "来源暂缺，请核实校方信息 / Source unavailable; check the official event page.",
        },
        copy,
      );
      expect(missing).toBe(copy.sourceUnavailableDescription);
      const changed = youngNotificationDescription(
        {
          kind: "event_changed",
          body: "活动信息有更新，请查看最新时间、地点和报名状态 / Event details changed; check the latest time, venue and registration status.",
        },
        copy,
      );
      expect(changed).toBe(copy.notificationDescriptions.event_changed);
      expect(changed).not.toBe(missing);
    });
  });
}
