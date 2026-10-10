import { nodeProtocolTest } from "./node-protocol-fixture";

/** Explicit consumer state; database and runtime are owned before setup starts. */
export const workspaceNavigationTest = nodeProtocolTest.extend(
  "navigation",
  async ({ isolatedDatabase, protocolRuntime }) =>
    protocolRuntime.run(() =>
      isolatedDatabase.owner.$transaction(async (db) => {
        const referenceDate = new Date("2026-04-29T08:00:00+08:00");
        // Public catalog caches must not reuse equal local IDs from another DB.
        await db.staticImportState.create({
          data: {
            id: "global",
            snapshotSha256: crypto.randomUUID().replaceAll("-", "").repeat(2),
            snapshotGeneratedAt: referenceDate,
            transformRevision: 6,
          },
        });
        const semester = await db.semester.create({
          data: {
            jwId: 1,
            code: "navigation-spring",
            nameCn: "2026春",
            startDate: new Date("2026-04-01T00:00:00Z"),
            endDate: new Date("2026-07-31T00:00:00Z"),
          },
        });
        const users = [];
        const sections = [];
        const schedules = [];
        const exams = [];
        for (const [index, label] of ["viewer", "other"].entries()) {
          const user = await db.user.create({
            data: {
              id: `navigation-${label}`,
              name: `Navigation ${label}`,
              username: `navigation-${label}`,
              email: `navigation-${label}@example.test`,
              emailVerified: true,
              calendarFeedToken: `navigation-${label}-feed`,
            },
          });
          users.push(user);
          const course = await db.course.create({
            data: {
              jwId: index + 1,
              code: `NAV-${label}`,
              nameCn: `导航课程 ${label}`,
              nameEn: `Navigation course ${label}`,
            },
          });
          const section = await db.section.create({
            data: {
              jwId: index + 1,
              code: `NAV-${label}.01`,
              courseId: course.id,
              semesterId: semester.id,
            },
          });
          sections.push(section);
          await db.userSectionSubscription.create({
            data: { userId: user.id, sectionId: section.id },
          });
          const group = await db.scheduleGroup.create({
            data: {
              jwId: index + 1,
              sectionId: section.id,
              no: 1,
              limitCount: 20,
              stdCount: 1,
              actualPeriods: 2,
              isDefault: true,
            },
          });
          schedules.push(
            await db.schedule.create({
              data: {
                sectionId: section.id,
                scheduleGroupId: group.id,
                date: new Date("2026-04-29T00:00:00Z"),
                weekday: 3,
                periods: 2,
                startTime: 900,
                endTime: 1040,
                startUnit: 1,
                endUnit: 2,
                weekIndex: 5,
              },
            }),
          );
          exams.push(
            await db.exam.create({
              data: {
                jwId: index + 1,
                sectionId: section.id,
                examDate: new Date("2026-04-30T00:00:00Z"),
                startTime: 900,
                endTime: 1100,
              },
            }),
          );
          await db.homework.create({
            data: {
              id: `navigation-${label}-pending`,
              sectionId: section.id,
              title: `Navigation ${label} pending homework`,
              createdById: user.id,
              submissionDueAt: new Date("2026-04-30T12:00:00+08:00"),
            },
          });
          await db.todo.create({
            data: {
              id: `navigation-${label}-dated`,
              userId: user.id,
              title: `Navigation ${label} dated todo`,
              dueAt: new Date("2026-04-30T12:00:00+08:00"),
            },
          });
          await db.youngNotification.create({
            data: {
              userId: user.id,
              dedupeKey: "unread",
              kind: "event_changed",
              title: `Navigation ${label} unread reminder`,
              body: label,
            },
          });
        }
        const viewer = users[0];
        const section = sections[0];
        await db.todo.createMany({
          data: [
            {
              userId: viewer.id,
              title: "Undated pending todo",
            },
            {
              userId: viewer.id,
              title: "Completed todo",
              completed: true,
              dueAt: new Date("2026-04-30T12:00:00+08:00"),
            },
          ],
        });
        const completedHomework = await db.homework.create({
          data: {
            title: "Completed homework",
            sectionId: section.id,
            submissionDueAt: new Date("2026-04-30T12:00:00+08:00"),
          },
        });
        await db.homeworkCompletion.create({
          data: { userId: viewer.id, homeworkId: completedHomework.id },
        });
        await db.homework.create({
          data: {
            title: "Deleted homework",
            sectionId: section.id,
            deletedAt: referenceDate,
            submissionDueAt: new Date("2026-04-30T12:00:00+08:00"),
          },
        });
        return {
          viewer,
          section,
          semester,
          schedule: schedules[0],
          exam: exams[0],
          referenceDate,
        };
      }),
    ),
);
