import { expect } from "vitest";
import { getIncompleteHomeworkCalendarItems } from "@/features/calendar/server/calendar-export-data";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import {
  setHomeworkCompletion,
  setHomeworkCompletions,
} from "@/features/homeworks/server/homework-completion";
import { test as calendarTest } from "../shared/calendar-commit-fixture";

const originalCompletedAt = new Date("2026-01-01T00:00:00Z");
const test = calendarTest.extend<{ homeworkId: string }>({
  homeworkId: async ({ calendar: { db, userId, sectionId, workflow }, task }, use) => {
    const homework = await workflow(() => db.$transaction(async (tx) => {
      await tx.userSectionSubscription.create({ data: { userId, sectionId } });
      return tx.homework.create({
        data: {
          sectionId,
          title: "Calendar homework",
          submissionDueAt: new Date("2027-01-01T00:00:00Z"),
        },
      });
    }));
    task.context.signal.throwIfAborted();
    await use(homework.id);
  },
});

for (const [label, before, content] of [
  ["creation", null, "Original content"],
  ["update", "Original content", "Updated content"],
  ["unchanged retry", "Updated content", "Updated content"],
] as const) {
  test(`homework description ${label} rebuild observes committed content`, async ({
    calendar,
    homeworkId,
  }) => calendar.workflow(async () => {
    const { db, userId, sectionId } = calendar;
    if (before !== null)
      await db.description.create({
        data: { homeworkId, content: before, lastEditedById: userId },
      });
    const visibleContent: (string | undefined)[] = [];
    const result = await calendar.run(
      () =>
        upsertDescriptionContent({
          targetType: "homework",
          targetId: homeworkId,
          userId,
          content,
        }),
      async () => {
        const rows = await getIncompleteHomeworkCalendarItems(userId, [
          sectionId,
        ]);
        visibleContent.push(
          rows.find((row) => row.id === homeworkId)?.description?.content,
        );
        // Also read independently of the calendar projection's query logic.
        expect(
          await db.description.findUnique({ where: { homeworkId } }),
        ).toMatchObject({ content });
      },
    );
    expect(result).toMatchObject({ ok: true, updated: before !== content });
    expect(calendar.messages).toEqual([{ type: "section", sectionId }]);
    expect(visibleContent).toEqual([content]);
    expect(await db.descriptionEdit.count()).toBe(before === content ? 0 : 1);
    expect(await db.auditLog.count()).toBe(before === content ? 0 : 1);
  }));
}

for (const mode of ["single", "batch"] as const) {
  test(`${mode} homework completion preserves timestamps across idempotent writes`, async ({
    calendar,
    homeworkId,
  }) => calendar.workflow(async () => {
    const { db, userId } = calendar;
    await db.homeworkCompletion.create({
      data: { userId, homeworkId, completedAt: originalCompletedAt },
    });
    const set = (completed: boolean) =>
      calendar.run(async () => {
        if (mode === "single")
          return setHomeworkCompletion({ userId, homeworkId, completed });
        const batch = await setHomeworkCompletions({
          userId,
          items: [{ homeworkId, completed }],
        });
        return batch.results[0];
      });
    for (let attempt = 0; attempt < 2; attempt++)
      expect(await set(true)).toMatchObject({
        success: true,
        completed: true,
        completedAt: originalCompletedAt,
      });
    expect(await set(false)).toMatchObject({
      success: true,
      completed: false,
      completedAt: null,
    });
    expect(await db.homeworkCompletion.count()).toBe(0);
    const recompleted = await set(true);
    expect(recompleted.success).toBe(true);
    if (!recompleted.success) throw new Error("Expected completion success");
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
  }));
}
