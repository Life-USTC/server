import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getIncompleteHomeworkCalendarItems } from "@/features/calendar/server/calendar-export-data";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import {
  setHomeworkCompletion,
  setHomeworkCompletions,
} from "@/features/homeworks/server/homework-completion";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const userId = crypto.randomUUID();
const homeworkIds = [crypto.randomUUID(), crypto.randomUUID()];
const originalCompletedAt = new Date("2026-01-01T00:00:00Z");
let sectionId: number;

beforeAll(async () => {
  const source = await db.section.findFirstOrThrow({
    where: { retiredAt: null },
    select: { courseId: true, semesterId: true },
  });
  const section = await db.section.create({
    data: {
      ...source,
      jwId: -Math.floor(Math.random() * 1_000_000_000) - 1,
      code: `[integration-test] calendar-${crypto.randomUUID()}`,
    },
  });
  sectionId = section.id;
  await db.user.create({
    data: {
      id: userId,
      name: "Calendar state test",
      email: `${userId}@test.invalid`,
    },
  });
  await db.userSectionSubscription.create({ data: { userId, sectionId } });
  await db.homework.createMany({
    data: homeworkIds.map((id) => ({
      id,
      sectionId,
      title: "[integration-test] Calendar state",
      submissionDueAt: new Date("2027-01-01T00:00:00Z"),
    })),
  });
});

afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  await db.auditLog.deleteMany({ where: { userId } });
  if (sectionId) await db.section.delete({ where: { id: sectionId } });
  await db.user.deleteMany({ where: { id: userId } });
  await Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]);
});

describe("calendar write state", () => {
  it("rebuilds homework descriptions only after the committed content is visible", async () => {
    const reads: Promise<string | undefined>[] = [];
    const messages: unknown[] = [];
    setCalendarExportRebuildSenderForTest(async (message) => {
      messages.push(message);
      reads.push(
        getIncompleteHomeworkCalendarItems(userId, [sectionId]).then(
          (rows) =>
            rows.find((row) => row.id === homeworkIds[0])?.description?.content,
        ),
      );
    });
    try {
      for (const content of [
        "Original content",
        "Updated content",
        "Updated content",
      ]) {
        await expect(
          upsertDescriptionContent({
            targetType: "homework",
            targetId: homeworkIds[0],
            userId,
            content,
          }),
        ).resolves.toMatchObject({ ok: true });
        expect(messages.at(-1)).toEqual({ type: "section", sectionId });
        expect(await reads.at(-1)).toBe(content);
      }
      expect(messages).toHaveLength(3);
    } finally {
      await Promise.all(reads);
      setCalendarExportRebuildSenderForTest();
    }
  });

  for (const mode of ["single", "batch"] as const) {
    it(`${mode} completion retries preserve the timestamp until reopened`, async () => {
      setCalendarExportRebuildSenderForTest(async () => {});
      const homeworkId = homeworkIds[mode === "single" ? 0 : 1];
      const set = async (completed: boolean) => {
        if (mode === "single") {
          return setHomeworkCompletion({ userId, homeworkId, completed });
        }
        const batch = await setHomeworkCompletions({
          userId,
          items: [{ homeworkId, completed }],
        });
        return batch.results[0];
      };
      await db.homeworkCompletion.create({
        data: { userId, homeworkId, completedAt: originalCompletedAt },
      });
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          expect(await set(true)).toMatchObject({
            success: true,
            completed: true,
            completedAt: originalCompletedAt,
          });
        }
        expect(await set(false)).toMatchObject({
          success: true,
          completedAt: null,
        });
        const recompleted = await set(true);
        expect(recompleted.success).toBe(true);
        if (!recompleted.success)
          throw new Error("Expected completion success");
        expect(recompleted.completedAt?.getTime()).toBeGreaterThan(
          originalCompletedAt.getTime(),
        );
        expect(await set(true)).toEqual(recompleted);
        expect(
          await db.homeworkCompletion.findUnique({
            where: { userId_homeworkId: { userId, homeworkId } },
            select: { completedAt: true },
          }),
        ).toEqual({ completedAt: recompleted.completedAt });
      } finally {
        setCalendarExportRebuildSenderForTest();
      }
    });
  }
});
