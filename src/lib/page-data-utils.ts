import type { Prisma } from "@/generated/prisma/client";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export const LIST_LIMIT = 30;
export const PAGE_SIZE = 20;

export async function getMessages(locale = "zh-cn") {
  return locale === "en-us"
    ? (await import("../../messages/en-us.json")).default
    : (await import("../../messages/zh-cn.json")).default;
}

export async function getPagePrisma(locale = "zh-cn") {
  const { getPrisma } = await import("@/lib/db/prisma");
  return getPrisma(locale);
}

export function parsePositivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function optionalValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function toLoadData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getLatestComments(
  where: Prisma.CommentWhereInput,
  take = 5,
  locale = "zh-cn",
) {
  const prisma = await getPagePrisma(locale);
  const comments = await prisma.comment.findMany({
    where: { ...where, status: { not: "deleted" } },
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      authorName: true,
      createdAt: true,
      user: { select: { name: true, username: true } },
    },
  });

  return comments.map((comment) => ({
    ...comment,
    createdAt: toShanghaiIsoString(comment.createdAt),
  }));
}
