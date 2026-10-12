import { describe } from "vitest";
import {
  listSubscribedExamPage,
  listSubscribedHomeworkPage,
  listSubscribedSchedulePage,
  listSubscribedSectionPage,
} from "@/features/subscriptions/server/subscription-read-model";
import { listTodoPage } from "@/features/todos/server/todo-service";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

describe("viewer page services", () => {
  it("paginates todos without crossing owners", {
    tags: ["@Todo/Service"],
  }, async ({ isolatedDatabase: { owner: db }, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const [firstUser, secondUser] = await db.$transaction(async (tx) => {
        const first = await tx.user.create({
          data: {
            email: "viewer-a@example.test",
            todos: {
              create: [
                {
                  id: "todo-a-1",
                  title: "Viewer A first",
                  dueAt: new Date("2026-04-29T01:00:00.000Z"),
                },
                {
                  id: "todo-a-2",
                  title: "Viewer A second",
                  dueAt: new Date("2026-04-29T02:00:00.000Z"),
                },
              ],
            },
          },
        });
        const second = await tx.user.create({
          data: {
            email: "viewer-b@example.test",
            todos: {
              create: {
                id: "todo-b",
                title: "Viewer B",
                dueAt: new Date("2026-04-29T03:00:00.000Z"),
              },
            },
          },
        });
        return [first, second];
      });
      const read = (userId: string, page: number) =>
        protocolRuntime.request(() =>
          listTodoPage({
            pagination: { page, pageSize: 1 },
            userId,
          }),
        );
      const firstPage = await read(firstUser.id, 1);
      const secondPage = await read(firstUser.id, 2);
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
      expect([firstPage.data[0].id, secondPage.data[0].id]).toEqual([
        "todo-a-1",
        "todo-a-2",
      ]);
      const otherPage = await read(secondUser.id, 1);
      expect(otherPage.pagination.total).toBe(1);
      expect(otherPage.data.map((todo) => todo.id)).toEqual(["todo-b"]);
      const pastEnd = await read(firstUser.id, 3);
      expect(pastEnd.pagination.total).toBe(2);
      expect(pastEnd.data).toEqual([]);
    });
  });

  it("keeps every subscribed page inside the principal's section relation", {
    tags: ["@Subscription/Service"],
  }, async ({ isolatedDatabase: { owner: db }, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const firstSectionId = 1;
      const secondSectionId = 2;
      const users = await db.$transaction(async (tx) => {
        const semester = await tx.semester.create({
          data: { jwId: 1, code: "2026-autumn", nameCn: "2026秋" },
        });
        const course = await tx.course.create({
          data: { jwId: 1, code: "viewer-course", nameCn: "Viewer course" },
        });
        const users = [];
        for (const id of [firstSectionId, secondSectionId]) {
          const user = await tx.user.create({
            data: { email: `viewer-${id}@example.test` },
          });
          users.push(user);
          await tx.section.create({
            data: {
              id,
              jwId: id,
              code: `viewer-section-${id}`,
              courseId: course.id,
              semesterId: semester.id,
              sectionSubscriptions: { create: { userId: user.id } },
              homeworks: {
                create: {
                  id: `homework-${id}`,
                  title: `Viewer homework ${id}`,
                },
              },
              exams: {
                create: {
                  id,
                  jwId: id,
                  examDate: new Date("2026-04-29T00:00:00.000Z"),
                  startTime: 900,
                  endTime: 1100,
                },
              },
            },
          });
          await tx.scheduleGroup.create({
            data: {
              jwId: id,
              no: 1,
              limitCount: 20,
              stdCount: 10,
              actualPeriods: 2,
              isDefault: true,
              sectionId: id,
              schedules: {
                create: {
                  id,
                  sectionId: id,
                  periods: 2,
                  date: new Date("2026-04-29T00:00:00.000Z"),
                  weekday: 3,
                  startTime: 800,
                  endTime: 945,
                  weekIndex: 1,
                  startUnit: 1,
                  endUnit: 2,
                },
              },
            },
          });
        }
        await tx.homework.create({
          data: {
            id: "deleted-homework",
            title: "Deleted homework",
            sectionId: firstSectionId,
            deletedAt: new Date("2026-04-28T00:00:00.000Z"),
          },
        });
        return users;
      });
      const pagination = { page: 1, pageSize: 100 };
      const read = (userId: string) =>
        Promise.all([
          protocolRuntime.request(() =>
            listSubscribedSectionPage(userId, { pagination }),
          ),
          protocolRuntime.request(() =>
            listSubscribedHomeworkPage(userId, { pagination }),
          ),
          protocolRuntime.request(() =>
            listSubscribedSchedulePage(userId, { pagination }),
          ),
          protocolRuntime.request(() =>
            listSubscribedExamPage(userId, { pagination }),
          ),
        ]);
      const [sections, homeworks, schedules, exams] = await read(users[0].id);
      expect(sections.pagination.total).toBe(1);
      expect(sections.data.map((section) => section.id)).toEqual([
        firstSectionId,
      ]);

      expect(homeworks.pagination.total).toBe(1);
      expect(homeworks.data.length).toBe(1);
      expect(
        homeworks.data.every(
          (homework) => homework.section?.id === firstSectionId,
        ),
      ).toBe(true);

      expect(schedules.pagination.total).toBe(1);
      expect(schedules.data.length).toBe(1);
      expect(
        schedules.data.every(
          (schedule) => schedule.section.id === firstSectionId,
        ),
      ).toBe(true);

      expect(exams.pagination.total).toBe(1);
      expect(exams.data.length).toBe(1);
      expect(
        exams.data.every((exam) => exam.section.id === firstSectionId),
      ).toBe(true);
      expect(
        [...homeworks.data, ...schedules.data, ...exams.data].every(
          (item) => item.section?.id !== secondSectionId,
        ),
      ).toBe(true);
      expect(homeworks.data.map((row) => row.id)).toEqual(["homework-1"]);
      expect(schedules.data.map((row) => row.id)).toEqual([1]);
      expect(exams.data.map((row) => row.id)).toEqual([1]);
      const [otherSections, otherHomeworks, otherSchedules, otherExams] =
        await read(users[1].id);
      expect({
        sections: otherSections.data.map((row) => row.id),
        homeworks: otherHomeworks.data.map((row) => row.id),
        schedules: otherSchedules.data.map((row) => row.id),
        exams: otherExams.data.map((row) => row.id),
      }).toEqual({
        sections: [2],
        homeworks: ["homework-2"],
        schedules: [2],
        exams: [2],
      });
      expect(
        [otherSections, otherHomeworks, otherSchedules, otherExams].map(
          (page) => page.pagination.total,
        ),
      ).toEqual([1, 1, 1, 1]);
    });
  });
});
