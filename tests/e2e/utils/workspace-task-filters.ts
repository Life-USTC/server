import type { Page } from "@playwright/test";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { DEV_SEED } from "./dev-seed";
import { PLAYWRIGHT_BASE_URL } from "./e2e-db";
import { withE2ePrisma } from "./e2e-db/prisma";

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

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function shanghaiDateFromOffset(offsetDays: number) {
  const target = new Date(Date.now() + offsetDays * DAY_MS);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(target);
  const values = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

async function createSignedSessionCookie(userId: string) {
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

  const authContext = await getBetterAuthInstance().$context;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authContext.secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sessionToken),
  );
  const signedValue = encodeURIComponent(
    `${sessionToken}.${base64(new Uint8Array(signature))}`,
  );

  return {
    name: authContext.authCookies.sessionToken.name,
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
          examDate: new Date(`${shanghaiDateFromOffset(-3)}T00:00:00+08:00`),
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
            examDate: new Date(
              `${shanghaiDateFromOffset(3)}T00:00:00+08:00`,
            ),
            examMode: "E2E open book",
            examRooms: {
              create: [{ count: 1, room: pendingExamRoom }],
            },
            examTakeCount: 1,
            examType: 1,
            jwId: firstJwId + 3,
            sectionId: section.id,
            startTime: 1400,
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

  const sessionCookie = await createSignedSessionCookie(created.userId);
  await page.context().addCookies([sessionCookie]);

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
