import type { CommentStatus, Prisma } from "@/generated/prisma/client";
import { ilike } from "@/lib/query-helpers";

const MODERATION_TABS = new Set([
  "comments",
  "descriptions",
  "homeworks",
  "suspensions",
]);
type ModerationTab = "comments" | "descriptions" | "homeworks" | "suspensions";
const DESCRIPTION_CONTENT_FILTERS = new Set(["withContent", "empty", "all"]);
const DESCRIPTION_TARGET_FILTERS = new Set([
  "homework",
  "course",
  "section",
  "teacher",
  "all",
]);

export function getModerationFilters(url: URL) {
  const tabParam = url.searchParams.get("tab") ?? "comments";
  const descriptionContentParam =
    url.searchParams.get("descriptionContent") ?? "withContent";
  const descriptionTargetParam =
    url.searchParams.get("descriptionTarget") ?? "all";

  return {
    tab: (MODERATION_TABS.has(tabParam)
      ? tabParam
      : "comments") as ModerationTab,
    search: url.searchParams.get("search")?.trim() ?? "",
    status: url.searchParams.get("status") ?? "active",
    descriptionContent: DESCRIPTION_CONTENT_FILTERS.has(descriptionContentParam)
      ? descriptionContentParam
      : "withContent",
    descriptionTarget: DESCRIPTION_TARGET_FILTERS.has(descriptionTargetParam)
      ? descriptionTargetParam
      : "all",
  };
}

export function buildCommentWhere(status: string): Prisma.CommentWhereInput {
  if (status === "all") return {};
  if (status === "suspended") {
    return {
      user: {
        suspensions: {
          some: {
            liftedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
    };
  }
  return { status: status as CommentStatus };
}

export function buildHomeworkWhere(search: string): Prisma.HomeworkWhereInput {
  return search
    ? {
        OR: [
          { title: ilike(search) },
          { section: { code: ilike(search) } },
          { section: { course: { code: ilike(search) } } },
          { section: { course: { nameCn: ilike(search) } } },
        ],
      }
    : {};
}

export function buildDescriptionWhere(
  search: string,
  descriptionContent: string,
  descriptionTarget: string,
): Prisma.DescriptionWhereInput {
  const filters: Prisma.DescriptionWhereInput[] = [];
  if (search) {
    filters.push({
      OR: [
        { content: ilike(search) },
        { course: { code: ilike(search) } },
        { course: { nameCn: ilike(search) } },
        { section: { code: ilike(search) } },
        { section: { course: { nameCn: ilike(search) } } },
        { teacher: { nameCn: ilike(search) } },
        { homework: { title: ilike(search) } },
      ],
    });
  }
  if (descriptionContent === "withContent") {
    filters.push({ content: { not: "" } });
  } else if (descriptionContent === "empty") {
    filters.push({ content: "" });
  }
  if (descriptionTarget === "course") {
    filters.push({ courseId: { not: null } });
  } else if (descriptionTarget === "section") {
    filters.push({ sectionId: { not: null } });
  } else if (descriptionTarget === "teacher") {
    filters.push({ teacherId: { not: null } });
  } else if (descriptionTarget === "homework") {
    filters.push({ homeworkId: { not: null } });
  }
  return filters.length > 0 ? { AND: filters } : {};
}
