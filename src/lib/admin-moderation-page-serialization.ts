import type {
  AdminModerationCommentRecord,
  AdminModerationDescriptionRecord,
  AdminModerationHomeworkRecord,
  AdminModerationSuspensionRecord,
} from "@/lib/admin-moderation-types";
import { toLoadData } from "@/lib/page-data-utils";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

type ModerationTab = "comments" | "descriptions" | "homeworks" | "suspensions";

export function serializeAdminModerationPageData(input: {
  comments: AdminModerationCommentRecord[];
  descriptions: AdminModerationDescriptionRecord[];
  filters: {
    descriptionContent: string;
    descriptionTarget: string;
    search: string;
    status: string;
  };
  homeworks: AdminModerationHomeworkRecord[];
  suspensions: AdminModerationSuspensionRecord[];
  tab: ModerationTab;
}) {
  return toLoadData({
    tab: input.tab,
    filters: input.filters,
    comments: input.comments.map((comment) => ({
      ...comment,
      createdAt: toShanghaiIsoString(comment.createdAt),
    })),
    descriptions: input.descriptions.map((description) => ({
      ...description,
      updatedAt: toShanghaiIsoString(description.updatedAt),
      lastEditedAt: description.lastEditedAt
        ? toShanghaiIsoString(description.lastEditedAt)
        : null,
    })),
    homeworks: input.homeworks.map((homework) => ({
      ...homework,
      createdAt: toShanghaiIsoString(homework.createdAt),
      deletedAt: homework.deletedAt
        ? toShanghaiIsoString(homework.deletedAt)
        : null,
      submissionDueAt: homework.submissionDueAt
        ? toShanghaiIsoString(homework.submissionDueAt)
        : null,
    })),
    suspensions: input.suspensions.map((suspension) => ({
      ...suspension,
      createdAt: toShanghaiIsoString(suspension.createdAt),
      expiresAt: suspension.expiresAt
        ? toShanghaiIsoString(suspension.expiresAt)
        : null,
      liftedAt: suspension.liftedAt
        ? toShanghaiIsoString(suspension.liftedAt)
        : null,
    })),
  });
}
