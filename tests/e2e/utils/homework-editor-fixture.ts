import { expect, type Page } from "@playwright/test";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { DEV_SEED } from "./dev-seed";
import { withE2ePrisma } from "./e2e-db/prisma";
import { createWorkspaceTaskFilterFixture } from "./workspace-task-filters";

export async function createHomeworkEditorFixture(page: Page) {
  const fixture = await createWorkspaceTaskFilterFixture(page);
  const sectionIds: number[] = [];
  try {
    const response = await page.request.get("/api/auth/get-session");
    expect(response.ok()).toBe(true);
    const session = (await response.json()) as { user: { id: string } };
    const nextDates = [2, 4].map((days) =>
      formatShanghaiDate(new Date(Date.now() + days * 86_400_000)),
    );
    const sections = await withE2ePrisma(async (prisma) => {
      const subscription =
        await prisma.userSectionSubscription.findFirstOrThrow({
          where: { userId: session.user.id },
          include: { section: true },
        });
      const first = subscription.section;
      sectionIds.push(first.id);
      const maxSection = await prisma.section.aggregate({
        _max: { jwId: true },
      });
      const second = await prisma.section.create({
        data: {
          code: `${first.code}-second`,
          jwId: (maxSection._max.jwId ?? 0) + 1,
          courseId: first.courseId,
          semesterId: first.semesterId,
        },
      });
      sectionIds.push(second.id);
      await prisma.userSectionSubscription.create({
        data: { userId: session.user.id, sectionId: second.id },
      });
      const teacher = await prisma.teacher.findUniqueOrThrow({
        where: { jwId: DEV_SEED.teacher.jwId },
      });
      const maxGroup = await prisma.scheduleGroup.aggregate({
        _max: { jwId: true },
      });
      for (const [index, section] of [first, second].entries()) {
        await prisma.section.update({
          where: { id: section.id },
          data: { teachers: { connect: { id: teacher.id } } },
        });
        const group = await prisma.scheduleGroup.create({
          data: {
            sectionId: section.id,
            jwId: (maxGroup._max.jwId ?? 0) + index + 1,
            no: 1,
            limitCount: 30,
            stdCount: 1,
            actualPeriods: 2,
            isDefault: true,
          },
        });
        await prisma.schedule.create({
          data: {
            sectionId: section.id,
            scheduleGroupId: group.id,
            date: new Date(`${nextDates[index]}T00:00:00Z`),
            weekday: new Date(`${nextDates[index]}T00:00:00Z`).getUTCDay(),
            startTime: 800,
            endTime: 945,
            startUnit: 1,
            endUnit: 2,
            periods: 2,
            weekIndex: 1,
          },
        });
      }
      return [first, second];
    });
    return {
      sections,
      dueValues: nextDates.map((date) => `${date}T08:00`),
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }

  async function cleanup() {
    await withE2ePrisma(async (prisma) => {
      await prisma.schedule.deleteMany({
        where: { sectionId: { in: sectionIds } },
      });
      await prisma.scheduleGroup.deleteMany({
        where: { sectionId: { in: sectionIds } },
      });
      // The generic fixture owns the first section; remove only the extra section here.
      await prisma.section.deleteMany({
        where: { id: { in: sectionIds.slice(1) } },
      });
    });
    await fixture.cleanup();
  }
}
