import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { getCookies } from "better-auth/cookies";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { DEV_SEED } from "./dev-seed";
import { PLAYWRIGHT_BASE_URL } from "./e2e-db/core";
import { withE2ePrisma } from "./e2e-db/prisma";

// Matches the local Worker configuration in wrangler.e2e.jsonc.
const E2E_AUTH_SECRET = "e2e-dev-secret-not-for-production";

const DAY_MS = 24 * 60 * 60 * 1_000;

type WorkspaceTaskFilterFixtureData = {
  userId: string;
  courseId: number;
  sectionId: number;
};

type WorkspaceTaskFilterTitles = {
  homeworks: string;
  todos: string;
  exams: string;
};

export type WorkspaceTaskFilterFixture = {
  completedTitle: WorkspaceTaskFilterTitles;
  pendingTitle: WorkspaceTaskFilterTitles;
  cleanup: () => Promise<void>;
};

function shanghaiDateFromOffset(offsetDays: number) {
  return formatShanghaiDate(new Date(Date.now() + offsetDays * DAY_MS));
}

async function createSignedSessionCookie(userId: string, secret: string) {
  const sessionToken = crypto.randomUUID();
  await withE2ePrisma((prisma) =>
    prisma.session.create({
      data: {
        expires: new Date(Date.now() + 60 * 60 * 1_000),
        sessionToken,
        userId,
      },
    }),
  );

  const signature = createHmac("sha256", secret)
    .update(sessionToken)
    .digest("base64");
  const signedValue = encodeURIComponent(`${sessionToken}.${signature}`);

  return {
    name: getCookies({ baseURL: PLAYWRIGHT_BASE_URL }).sessionToken.name,
    url: PLAYWRIGHT_BASE_URL,
    value: signedValue,
  };
}

export async function createWorkspaceTaskFilterFixture(
  page: Page,
  options: { includePending?: boolean } = {},
): Promise<WorkspaceTaskFilterFixture> {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 9);
  const marker = `e2e-filter-${suffix}`;
  const includePending = options.includePending ?? false;
  const courseName = `E2E Filter Course ${suffix}`;
  const courseCode = `E2EF${suffix}`;
  const sectionCode = `${courseCode}.01`;
  const completedHomeworkTitle = `${marker} completed homework`;
  const pendingHomeworkTitle = `${marker} pending homework`;
  const completedTodoTitle = `${marker} completed todo`;
  const pendingTodoTitle = `${marker} pending todo`;
  const completedExamRoom = `${marker}-past-room`;
  const pendingExamRoom = `${marker}-upcoming-room`;

  const created = await withE2ePrisma(async (prisma) => {
    const semester = await prisma.semester.findUnique({
      where: { jwId: DEV_SEED.semesterJwId },
      select: { id: true },
    });
    if (!semester) {
      throw new Error(
        `Seed semester ${DEV_SEED.semesterJwId} is required for workspace filter fixtures`,
      );
    }

    const maxCourse = await prisma.course.aggregate({
      _max: { jwId: true },
    });
    const firstJwId = Math.max(1_500_000_000, (maxCourse._max.jwId ?? 0) + 1);

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `${marker}@example.test`,
          emailVerified: true,
          name: marker,
          username: marker,
        },
        select: { id: true },
      });
      const course = await tx.course.create({
        data: {
          code: courseCode,
          jwId: firstJwId,
          nameCn: courseName,
          nameEn: courseName,
        },
        select: { id: true },
      });
      const section = await tx.section.create({
        data: {
          code: sectionCode,
          courseId: course.id,
          jwId: firstJwId + 1,
          semesterId: semester.id,
        },
        select: { id: true },
      });

      await tx.userSectionSubscription.create({
        data: { sectionId: section.id, userId: user.id },
      });

      const homework = await tx.homework.create({
        data: {
          createdById: user.id,
          publishedAt: new Date(),
          sectionId: section.id,
          submissionDueAt: new Date(Date.now() + 7 * DAY_MS),
          title: completedHomeworkTitle,
        },
        select: { id: true },
      });
      await tx.homeworkCompletion.create({
        data: { homeworkId: homework.id, userId: user.id },
      });
      if (includePending) {
        await tx.homework.create({
          data: {
            createdById: user.id,
            publishedAt: new Date(),
            sectionId: section.id,
            submissionDueAt: new Date(Date.now() + 7 * DAY_MS),
            title: pendingHomeworkTitle,
          },
        });
      }

      await tx.todo.create({
        data: {
          completed: true,
          content: `${marker} todo content`,
          dueAt: new Date(Date.now() + 7 * DAY_MS),
          priority: "high",
          title: completedTodoTitle,
          userId: user.id,
        },
      });
      if (includePending) {
        await tx.todo.create({
          data: {
            completed: false,
            content: `${marker} pending todo content`,
            dueAt: new Date(Date.now() + 7 * DAY_MS),
            priority: "medium",
            title: pendingTodoTitle,
            userId: user.id,
          },
        });
      }

      await tx.exam.create({
        data: {
          endTime: 1100,
          examDate: new Date(`${shanghaiDateFromOffset(-3)}T00:00:00Z`),
          examMode: "E2E closed book",
          examRooms: {
            create: [{ count: 1, room: completedExamRoom }],
          },
          examTakeCount: 1,
          examType: 1,
          jwId: firstJwId + 2,
          sectionId: section.id,
          startTime: 900,
        },
      });

      if (includePending) {
        await tx.exam.create({
          data: {
            endTime: 1100,
            examDate: new Date(`${shanghaiDateFromOffset(3)}T00:00:00Z`),
            examMode: "E2E open book",
            examRooms: {
              create: [{ count: 1, room: pendingExamRoom }],
            },
            examTakeCount: 1,
            examType: 1,
            jwId: firstJwId + 3,
            sectionId: section.id,
            startTime: 900,
          },
        });
      }

      return {
        courseId: course.id,
        sectionId: section.id,
        userId: user.id,
      };
    });
  });

  try {
    const sessionCookie = await createSignedSessionCookie(
      created.userId,
      E2E_AUTH_SECRET,
    );
    await page.context().addCookies([sessionCookie]);
  } catch (error) {
    await cleanupWorkspaceTaskFilterFixture(created);
    throw error;
  }

  let cleaned = false;
  return {
    completedTitle: {
      exams: completedExamRoom,
      homeworks: completedHomeworkTitle,
      todos: completedTodoTitle,
    },
    pendingTitle: {
      exams: pendingExamRoom,
      homeworks: pendingHomeworkTitle,
      todos: pendingTodoTitle,
    },
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      await cleanupWorkspaceTaskFilterFixture(created);
    },
  };
}

export async function cleanupWorkspaceTaskFilterFixture(
  fixture: WorkspaceTaskFilterFixtureData,
) {
  await withE2ePrisma(async (prisma) => {
    await prisma.section.deleteMany({ where: { id: fixture.sectionId } });
    await prisma.course.deleteMany({ where: { id: fixture.courseId } });
    await prisma.user.deleteMany({ where: { id: fixture.userId } });
  });
}
