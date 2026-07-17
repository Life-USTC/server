import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listSubscribedExamPage,
  listSubscribedHomeworkPage,
  listSubscribedSchedulePage,
  listSubscribedSectionPage,
} from "@/features/subscriptions/server/subscription-read-model";
import { listTodoPage } from "@/features/todos/server/todo-service";
import { prisma } from "@/lib/db/prisma";

describe("viewer page services", () => {
  let firstSectionId = 0;
  let secondSectionId = 0;
  let firstUserId = "";
  let secondUserId = "";
  let userEmails: string[] = [];

  beforeAll(async () => {
    const sections = await prisma.section.findMany({
      where: {
        schedules: { some: {} },
        homeworks: { some: { deletedAt: null } },
        exams: { some: {} },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (sections.length < 2) {
      throw new Error("Expected two seeded sections with viewer data");
    }
    firstSectionId = sections[0].id;
    secondSectionId = sections[1].id;

    const marker = crypto.randomUUID();
    userEmails = [
      `integration-viewer-a-${marker}@example.test`,
      `integration-viewer-b-${marker}@example.test`,
    ];
    const [firstUser, secondUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: userEmails[0],
          name: "Viewer Page A",
          subscribedSections: { connect: { id: firstSectionId } },
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: userEmails[1],
          name: "Viewer Page B",
          subscribedSections: { connect: { id: secondSectionId } },
        },
        select: { id: true },
      }),
    ]);
    firstUserId = firstUser.id;
    secondUserId = secondUser.id;

    await prisma.todo.createMany({
      data: [
        {
          title: `[integration-test] viewer-a-1-${marker}`,
          dueAt: new Date("2026-04-29T01:00:00.000Z"),
          userId: firstUserId,
        },
        {
          title: `[integration-test] viewer-a-2-${marker}`,
          dueAt: new Date("2026-04-29T02:00:00.000Z"),
          userId: firstUserId,
        },
        {
          title: `[integration-test] viewer-b-${marker}`,
          dueAt: new Date("2026-04-29T03:00:00.000Z"),
          userId: secondUserId,
        },
      ],
    });
  });

  afterAll(async () => {
    if (userEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: userEmails } },
      });
    }
    await prisma.$disconnect();
  });

  it("paginates todos without crossing owners", async () => {
    const firstPage = await listTodoPage({
      pagination: { page: 1, pageSize: 1 },
      userId: firstUserId,
    });
    const secondPage = await listTodoPage({
      pagination: { page: 2, pageSize: 1 },
      userId: firstUserId,
    });

    expect(firstPage.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(secondPage.pagination.total).toBe(2);
    expect(firstPage.data).toHaveLength(1);
    expect(secondPage.data).toHaveLength(1);
    expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
  });

  it("keeps every subscribed page inside the principal's section relation", async () => {
    const pagination = { page: 1, pageSize: 100 };
    const [sections, homeworks, schedules, exams] = await Promise.all([
      listSubscribedSectionPage(firstUserId, { pagination }),
      listSubscribedHomeworkPage(firstUserId, { pagination }),
      listSubscribedSchedulePage(firstUserId, { pagination }),
      listSubscribedExamPage(firstUserId, { pagination }),
    ]);
    const [homeworkTotal, scheduleTotal, examTotal] = await Promise.all([
      prisma.homework.count({
        where: { deletedAt: null, sectionId: firstSectionId },
      }),
      prisma.schedule.count({ where: { sectionId: firstSectionId } }),
      prisma.exam.count({ where: { sectionId: firstSectionId } }),
    ]);

    expect(sections.pagination.total).toBe(1);
    expect(sections.data.map((section) => section.id)).toEqual([
      firstSectionId,
    ]);

    expect(homeworks.pagination.total).toBe(homeworkTotal);
    expect(homeworks.data.length).toBe(homeworkTotal);
    expect(
      homeworks.data.every(
        (homework) => homework.section?.id === firstSectionId,
      ),
    ).toBe(true);

    expect(schedules.pagination.total).toBe(scheduleTotal);
    expect(schedules.data.length).toBe(scheduleTotal);
    expect(
      schedules.data.every(
        (schedule) => schedule.section.id === firstSectionId,
      ),
    ).toBe(true);

    expect(exams.pagination.total).toBe(examTotal);
    expect(exams.data.length).toBe(examTotal);
    expect(exams.data.every((exam) => exam.section.id === firstSectionId)).toBe(
      true,
    );
    expect(
      [...homeworks.data, ...schedules.data, ...exams.data].every(
        (item) => item.section?.id !== secondSectionId,
      ),
    ).toBe(true);
  });
});
