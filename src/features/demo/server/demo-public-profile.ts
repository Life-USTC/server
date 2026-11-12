import type { z } from "zod";
import type { AppLocale } from "@/i18n/config";
import type { publicUserProfileResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";
import {
  addCampusDays,
  campusDateKeyRange,
  campusWeekStartKey,
  requireCampusDateKeyForValue,
} from "@/lib/time/campus-date";
import { DEMO_REFERENCE_NOW } from "../lib/demo-types";
import { getDemoDiscussionRecords } from "./demo-community";
import {
  type DemoCommunityRecord,
  getDemoDiscussionAuthor,
} from "./demo-community-fixture";
import { getDemoHomeworks } from "./demo-homeworks";

type Profile = z.output<typeof publicUserProfileResponseSchema>;
type Homework = Pick<
  ReturnType<typeof getDemoHomeworks>[number],
  "createdById" | "createdAt" | "deletedAt"
>;

// An explicit fictional joined-date fact, independent of the first discussion.
const SAMPLE_JOINED_AT = "2026-09-01T01:00:00.000Z";

export function projectDemoProfileActivity(
  userId: string,
  records: readonly DemoCommunityRecord[],
  homeworks: readonly Homework[],
) {
  const comments = records
    .map(({ comment }) => comment)
    .filter(
      (comment) =>
        comment.userId === userId &&
        comment.status === "active" &&
        comment.visibility === "public" &&
        comment.isAnonymous === false &&
        comment.deletedAt == null,
    );
  const authoredHomeworks = homeworks.filter(
    (homework) =>
      homework.createdById === userId && homework.deletedAt === null,
  );
  const today = requireCampusDateKeyForValue(DEMO_REFERENCE_NOW);
  const since = addCampusDays(today, -364);
  const counts = new Map<string, number>();
  for (const date of [
    ...comments.map((comment) => comment.createdAt),
    ...authoredHomeworks.map((homework) => homework.createdAt),
  ]) {
    const day = requireCampusDateKeyForValue(date);
    if (day >= since && day <= today)
      counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const days = campusDateKeyRange(
    campusWeekStartKey(since, 0),
    addCampusDays(campusWeekStartKey(today, 0), 6),
  ).map((date) => ({ date, count: counts.get(date) ?? 0 }));
  const weeks: Profile["weeks"] = [];
  for (let index = 0; index < days.length; index += 7)
    weeks.push(days.slice(index, index + 7));
  return {
    commentCount: comments.length,
    homeworkCount: authoredHomeworks.length,
    totalContributions: [...counts.values()].reduce(
      (sum, count) => sum + count,
      0,
    ),
    weeks,
  };
}

export function getDemoPublicUserProfile(
  identifier: string,
  locale: AppLocale,
): Profile | null {
  const author = getDemoDiscussionAuthor(identifier, locale);
  if (!author) return null;
  const activity = projectDemoProfileActivity(
    author.id,
    getDemoDiscussionRecords(locale),
    getDemoHomeworks(locale),
  );
  return {
    user: {
      id: author.id,
      username: author.username,
      name: author.name,
      image: author.image,
      createdAt: SAMPLE_JOINED_AT,
      _count: {
        comments: activity.commentCount,
        homeworksCreated: activity.homeworkCount,
        // The closed sample graph has no authored upload records.
        uploads: 0,
      },
    },
    weeks: activity.weeks,
    totalContributions: activity.totalContributions,
  };
}
