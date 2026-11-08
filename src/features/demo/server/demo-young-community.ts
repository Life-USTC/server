import type { AppLocale } from "@/i18n/config";
import {
  type DemoCommunityRecord,
  getDemoCommunityRecords,
} from "./demo-community-fixture";

export const DEMO_YOUNG_COMMENT_ROOT = "demo-comment-young-01";
/** Named fictional readers; root/reply pagination uses the existing comment reader. */
export function getDemoYoungCommunityRecords(
  locale: AppLocale,
): DemoCommunityRecord[] {
  const originals = getDemoCommunityRecords(locale);
  const make = (
    id: string,
    index: number,
    parentId: string | null = null,
    rootId: string | null = null,
    youngId = "demo-young-1",
  ): DemoCommunityRecord => {
    const template = originals[index % 2]?.comment;
    if (!template) throw new Error("Missing fixed named discussion author");
    const at = new Date(
      Date.parse("2026-09-23T08:00:00+08:00") + index * 60_000,
    );
    return {
      target: { targetType: "young-event", youngId },
      comment: {
        ...template,
        id,
        body:
          locale === "en-us"
            ? `**Fictional activity discussion ${index + 1}.** This is a sample reading-group question, not an official registration or attendance record.`
            : `**虚构活动讨论 ${index + 1}。** 这是学习小组的样例提问，并非正式报名或参与记录。`,
        createdAt: at,
        updatedAt: new Date(at),
        parentId,
        rootId,
        reactionSummaries: [
          { type: "upvote", count: 1 + (index % 3), viewerHasReacted: false },
        ],
      },
    };
  };
  const roots = Array.from({ length: 21 }, (_, index) =>
    make(`demo-comment-young-${String(index + 1).padStart(2, "0")}`, index),
  );
  const replies = Array.from({ length: 11 }, (_, index) =>
    make(
      `demo-comment-young-reply-${String(index + 1).padStart(2, "0")}`,
      21 + index,
      index === 2 ? "demo-comment-young-reply-02" : DEMO_YOUNG_COMMENT_ROOT,
      DEMO_YOUNG_COMMENT_ROOT,
    ),
  );
  return [
    ...roots.toReversed(),
    ...replies.toReversed(),
    make("demo-comment-young-second", 32, null, null, "demo-young-2"),
  ];
}
