import { describe } from "vitest";
import { listUpcomingSubscribedExamsWithCount } from "@/features/subscriptions/server/subscription-schedule-exam-read-model";
import { getWorkspaceNavStats } from "@/features/workspace/server/workspace-nav-stats";
import { getWorkspaceNavigationSummary } from "@/features/workspace/server/workspace-navigation-summary";
import { getWorkspaceSemesters } from "@/features/workspace/server/workspace-overview-data";
import { getWorkspaceUserContext } from "@/features/workspace/server/workspace-user-context";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";
import { workspaceNavigationTest } from "../shared/workspace-navigation-fixture";

const examBoundaryTest = nodeProtocolTest.extend(
  "boundary",
  async ({ isolatedDatabase, protocolRuntime }) =>
    protocolRuntime.run(() =>
      isolatedDatabase.owner.$transaction(async (db) => {
        const user = await db.user.create({
          data: {
            name: "Exam boundary viewer",
            email: "exam-boundary@example.test",
          },
        });
        const course = await db.course.create({
          data: { jwId: 1, code: "EXAM-BOUNDARY", nameCn: "考试日期边界" },
        });
        const section = await db.section.create({
          data: { jwId: 1, code: "EXAM-BOUNDARY.01", courseId: course.id },
        });
        await db.userSectionSubscription.create({
          data: { userId: user.id, sectionId: section.id },
        });
        const exams: Array<{ id: number }> = [];
        for (const [index, values] of [
          {
            examDate: new Date("2026-09-27T00:00:00Z"),
            startTime: 900,
            endTime: 1000,
          },
          { examDate: null, startTime: 900, endTime: 1000 },
          {
            examDate: new Date("2026-09-28T00:00:00Z"),
            startTime: null,
            endTime: null,
          },
          {
            examDate: new Date("2026-09-28T00:00:00Z"),
            startTime: 0,
            endTime: 2359,
          },
          {
            examDate: new Date("2026-09-28T00:00:00Z"),
            startTime: 2359,
            endTime: null,
          },
          {
            examDate: new Date("2026-09-29T00:00:00Z"),
            startTime: 900,
            endTime: 1000,
          },
        ].entries())
          exams.push(
            await db.exam.create({
              data: { ...values, sectionId: section.id, jwId: index + 1 },
            }),
          );
        return { user, exams };
      }),
    ),
);

const reminderTest = nodeProtocolTest.extend(
  "reminders",
  async ({ isolatedDatabase, protocolRuntime }) =>
    protocolRuntime.run(() =>
      isolatedDatabase.owner.$transaction(async (db) => {
        const referenceDate = new Date("2026-09-25T00:00:00Z");
        const users = [];
        for (const label of ["viewer", "other"]) {
          users.push(
            await db.user.create({
              data: {
                name: `Reminder ${label}`,
                username: `reminder-${label}`,
                email: `reminder-${label}@example.test`,
                emailVerified: true,
              },
            }),
          );
        }
        await db.youngNotification.createMany({
          data: [
            {
              userId: users[0].id,
              dedupeKey: "unread",
              kind: "event_changed",
              title: "Visible",
              body: "Visible",
            },
            {
              userId: users[0].id,
              dedupeKey: "read",
              kind: "event_changed",
              title: "Read",
              body: "Read",
              readAt: referenceDate,
            },
            {
              userId: users[0].id,
              dedupeKey: "expired",
              kind: "event_changed",
              title: "Expired",
              body: "Expired",
              expiresAt: referenceDate,
            },
            {
              userId: users[1].id,
              dedupeKey: "other",
              kind: "event_changed",
              title: "Other",
              body: "Other",
            },
          ],
        });
        return { users, referenceDate };
      }),
    ),
);

describe("workspace navigation summary", () => {
  workspaceNavigationTest(
    "matches the existing workspace SSR navigation semantics",
    { tags: ["@Overview/Service"] },
    async ({
      navigation: { viewer, section, referenceDate },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const context = await protocolRuntime.request(() =>
          getWorkspaceUserContext(viewer.id),
        );
        expect(context).not.toBeNull();
        if (!context)
          throw new Error("Expected the explicitly arranged viewer");
        expect(context.sectionIds).toEqual([section.id]);

        const semesters = await protocolRuntime.request(() =>
          getWorkspaceSemesters(),
        );
        const [existing, summary] = await Promise.all([
          protocolRuntime.request(() =>
            getWorkspaceNavStats(
              context.user,
              context.subscribedSections,
              referenceDate,
              undefined,
              semesters,
            ),
          ),
          protocolRuntime.request(() =>
            getWorkspaceNavigationSummary(viewer.id, referenceDate),
          ),
        ]);

        // One schedule + exam + pending homework + dated pending todo. Foreign,
        // completed/deleted and undated rows must not inflate the calendar count.
        expect(summary).toEqual({
          userId: viewer.id,
          unreadActivityNotificationsCount: 1,
          calendarItemsCount: 4,
          examsCount: 1,
          pendingHomeworksCount: 1,
          pendingTodosCount: 2,
          subscribedSectionCount: 1,
        });
        // Keep SSR parity as an additional check, never as the only oracle.
        expect(summary).toEqual({
          userId: viewer.id,
          unreadActivityNotificationsCount:
            existing.unreadActivityNotificationsCount,
          calendarItemsCount: existing.calendarItemsCount,
          examsCount: existing.examsCount,
          pendingHomeworksCount: existing.pendingHomeworksCount,
          pendingTodosCount: existing.pendingTodosCount,
          subscribedSectionCount: context.sectionIds.length,
        });
      });
    },
  );

  examBoundaryTest(
    "upcoming exam counts use Shanghai calendar dates across midnight and exam end boundaries",
    { tags: ["@Overview/Service"] },
    async ({ boundary: { user, exams }, protocolRuntime, expect }) => {
      await protocolRuntime.run(async () => {
        for (const [atTime, indexes] of [
          ["2026-09-28T00:00:00+08:00", [2, 3, 4, 5]],
          ["2026-09-27T23:59:00+08:00", [2, 3, 4, 5]],
          ["2026-09-28T07:59:00+08:00", [2, 3, 4, 5]],
          ["2026-09-28T08:00:00+08:00", [2, 3, 4, 5]],
          ["2026-09-28T12:00:00+08:00", [2, 3, 4, 5]],
          ["2026-09-28T23:59:00+08:00", [2, 3, 4, 5]],
          ["2026-09-29T00:00:00+08:00", [5]],
          ["2026-09-29T10:00:00+08:00", [5]],
          ["2026-09-29T10:01:00+08:00", []],
        ] as const) {
          const reference = new Date(atTime);
          const summary = await protocolRuntime.request(() =>
            getWorkspaceNavigationSummary(user.id, reference),
          );
          expect(summary.examsCount, atTime).toBe(indexes.length);
          const overview = await protocolRuntime.request(() =>
            listUpcomingSubscribedExamsWithCount(user.id, {
              atTime: reference,
            }),
          );
          expect(overview.total, atTime).toBe(indexes.length);
          expect(overview.items.map(({ id }) => id).sort()).toEqual(
            indexes.map((index) => exams[index].id).sort(),
          );
        }
      });
    },
  );

  reminderTest(
    "counts only the viewer's unread, unexpired reminders even without course subscriptions",
    { tags: ["@Overview/Service"] },
    async ({
      reminders: { users, referenceDate },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const summary = await protocolRuntime.request(() =>
          getWorkspaceNavigationSummary(users[0].id, referenceDate),
        );
        expect(summary.unreadActivityNotificationsCount).toBe(1);
        expect(summary.subscribedSectionCount).toBe(0);
        const stats = await protocolRuntime.request(() =>
          getWorkspaceNavStats(users[0], [], referenceDate),
        );
        expect(stats.unreadActivityNotificationsCount).toBe(1);
      });
    },
  );
});
