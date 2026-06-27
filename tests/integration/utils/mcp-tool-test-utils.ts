import { afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../fixtures/dev-seed";
import { createMcpHarness, type McpHarness } from "./mcp-harness";

export { DEV_SEED, DEV_SEED_ANCHOR, prisma };

export const SEED_DATE = DEV_SEED_ANCHOR.date;
export const SEED_AT_TIME = DEV_SEED_ANCHOR.recommendedAtTime;
export const SEED_PLUS_THREE_DAYS = seedDatePlusDays(3);
export const SEED_PLUS_SIX_DAYS = seedDatePlusDays(6);
export const SEED_PLUS_SEVEN_DAYS = seedDatePlusDays(7);
export const SEED_PLUS_ELEVEN_DAYS = seedDatePlusDays(11);
export const SEED_PLUS_TWELVE_DAYS = seedDatePlusDays(12);
export const PAST_SAME_DAY_EXAM_JW_ID = 88_051_002;
export const UNKNOWN_DATE_EXAM_JW_ID = 88_051_003;

export type McpToolTestContext = {
  client: McpHarness;
  devUserId: string;
};

let currentDevUserId = "";

export function createMcpToolTestContext(): McpToolTestContext {
  const context = {
    client: undefined as unknown as McpHarness,
    devUserId: "",
  };

  beforeAll(async () => {
    const user = await prisma.user.findFirst({
      where: { username: DEV_SEED.debugUsername },
      select: { id: true },
    });
    if (!user) {
      throw new Error(
        `Dev seed user "${DEV_SEED.debugUsername}" not found. ` +
          "See the repo root `AGENTS.md` for the required DB + seed setup.",
      );
    }
    context.devUserId = user.id;
    currentDevUserId = user.id;
    context.client = await createMcpHarness(user.id);
  });

  afterAll(async () => {
    await context.client?.close();
    await prisma.$disconnect();
  });

  return context;
}

export function seedDatePlusDays(days: number) {
  const date = new Date(`${SEED_DATE}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function integrationUserEmail(prefix: string) {
  return `integration-${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}

export async function findDescriptionEditAuditLog(
  descriptionId: string,
  userId = currentDevUserId,
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const log = await prisma.auditLog.findFirst({
      where: {
        action: "description_edit",
        targetId: descriptionId,
        targetType: "description",
        userId,
      },
      select: { id: true, metadata: true },
    });
    if (log) return log;
    await sleep(25);
  }

  return null;
}

export function metadataMatches(
  metadata: unknown,
  expected: Record<string, unknown>,
) {
  if (typeof metadata !== "object" || metadata === null) return false;
  const record = metadata as Record<string, unknown>;
  return Object.entries(expected).every(
    ([key, value]) => record[key] === value,
  );
}

export async function findCommentAuditLog(input: {
  action:
    | "comment_create"
    | "comment_edit"
    | "comment_delete"
    | "comment_react";
  commentId: string;
  metadata: Record<string, unknown>;
  userId?: string;
}) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: input.action,
        targetId: input.commentId,
        targetType: "comment",
        userId: input.userId ?? currentDevUserId,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true },
      take: 10,
    });
    const log = logs.find((entry) =>
      metadataMatches(entry.metadata, input.metadata),
    );
    if (log) return log;
    await sleep(25);
  }

  return null;
}

export async function findUploadDeleteAuditLog(input: {
  metadata: Record<string, unknown>;
  uploadId: string;
  userId?: string;
}) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: "upload_delete",
        targetId: input.uploadId,
        targetType: "upload",
        userId: input.userId ?? currentDevUserId,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true },
      take: 10,
    });
    const log = logs.find((entry) =>
      metadataMatches(entry.metadata, input.metadata),
    );
    if (log) return log;
    await sleep(25);
  }

  return null;
}

export async function deleteCommentRecords(commentIds: string[]) {
  if (commentIds.length === 0) return;

  await prisma.auditLog.deleteMany({
    where: {
      targetId: { in: commentIds },
      targetType: "comment",
    },
  });
  await prisma.commentReaction.deleteMany({
    where: { commentId: { in: commentIds } },
  });
  await prisma.commentAttachment.deleteMany({
    where: { commentId: { in: commentIds } },
  });
  await prisma.comment.updateMany({
    where: { id: { in: commentIds } },
    data: { parentId: null, rootId: null },
  });
  await prisma.comment.deleteMany({
    where: { id: { in: commentIds } },
  });
}

export async function getUserSubscribedSectionIds(userId = currentDevUserId) {
  if (!userId) {
    throw new Error("Dev seed user was not initialized");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      subscribedSections: {
        select: { id: true },
        orderBy: { id: "asc" },
      },
    },
  });

  return user.subscribedSections.map((section) => section.id);
}

export async function replaceUserSubscribedSections(
  userId: string,
  sectionIds: number[],
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        set: sectionIds.map((id) => ({ id })),
      },
    },
  });
}

export async function ensureDevUserSubscribedToSeedSection(
  userId = currentDevUserId,
) {
  if (!userId) {
    throw new Error("Dev seed user was not initialized");
  }

  const section = await prisma.section.findUnique({
    where: { jwId: DEV_SEED.section.jwId },
    select: { id: true },
  });
  if (!section) {
    throw new Error(`Seed section ${DEV_SEED.section.jwId} not found`);
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      subscribedSections: {
        select: { id: true },
        where: { id: section.id },
        take: 1,
      },
    },
  });

  if (user.subscribedSections.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscribedSections: {
          connect: { id: section.id },
        },
      },
    });
  }

  return section.id;
}

export function shanghaiIsoOnSeedDate(hhmm: number, addMinutes = 0) {
  const hours = Math.trunc(hhmm / 100);
  const minutes = hhmm % 100;
  const date = new Date(
    Date.parse(
      `${SEED_DATE}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+08:00`,
    ) +
      addMinutes * 60_000,
  );
  return date
    .toLocaleString("sv-SE", {
      timeZone: "Asia/Shanghai",
      hour12: false,
    })
    .replace(" ", "T")
    .concat("+08:00");
}
