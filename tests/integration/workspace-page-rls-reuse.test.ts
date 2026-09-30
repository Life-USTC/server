import { describe } from "vitest";
import { loadSignedWorkspacePageData } from "@/features/workspace/server/workspace-page-load-signed";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { workspaceNavigationTest as test } from "../shared/workspace-navigation-fixture";

describe("signed workspace independent RLS contexts", () => {
  test("keeps overview and calendar data semantics across short RLS reads", async ({
    navigation: { viewer, section, semester, schedule, exam, referenceDate },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      expect(getUserRlsTransactionClient()).toBeUndefined();
      const data = await protocolRuntime.request(async () => {
        const result = await loadSignedWorkspacePageData({
          calendarSemesterId: undefined,
          locale: "en-us",
          overviewWeek: null,
          pageCopy: getWorkspacePageCopy("en-us"),
          referenceNow: referenceDate,
          requestId: "integration-workspace-rls-reuse",
          tab: "overview",
          userId: viewer.id,
        });
        expect(getUserRlsTransactionClient()).toBeUndefined();
        return result;
      });

      expect(data).toMatchObject({
        signedIn: true,
        tab: "overview",
      });
      expect("userMissing" in data).toBe(false);
      expect(data.navStats).toBeDefined();
      expect(data.overview).toBeDefined();
      expect(data.overview?.calendar).not.toHaveProperty("semesterWeeks");
      expect(data.overview?.calendar).not.toHaveProperty("semesterStart");
      expect(data.overview?.calendar).not.toHaveProperty(
        "calendarSemesterNavList",
      );

      const calendarData = await protocolRuntime.request(async () => {
        const result = await loadSignedWorkspacePageData({
          calendarSemesterId: undefined,
          locale: "en-us",
          overviewWeek: null,
          pageCopy: getWorkspacePageCopy("en-us"),
          referenceNow: referenceDate,
          requestId: "integration-workspace-calendar-rls-reuse",
          tab: "calendar",
          userId: viewer.id,
        });
        expect(getUserRlsTransactionClient()).toBeUndefined();
        return result;
      });

      expect(calendarData.overview?.calendar).toHaveProperty("semesterWeeks");
      expect(calendarData.overview?.calendar).toHaveProperty("semesterStart");
      expect(calendarData.overview?.calendar).toHaveProperty(
        "calendarSemesterNavList",
      );

      // Both independent RLS fan-outs must project only the arranged viewer.
      // Foreign subscriptions, completed/deleted homework and completed todos
      // are present in the database, so nonempty exact checks witness scope.
      for (const result of [data, calendarData]) {
        expect(result.subscribedSectionCount).toBe(1);
        expect(result.navStats).toMatchObject({
          user: { id: viewer.id },
          unreadActivityNotificationsCount: 1,
          calendarItemsCount: 4,
          examsCount: 1,
          pendingHomeworksCount: 1,
          pendingTodosCount: 2,
        });
        expect(result.overview?.user.id).toBe(viewer.id);
        expect(
          result.overview?.calendar.allSessions.map((item) => ({
            id: item.id,
            sectionJwId: item.sectionJwId,
          })),
        ).toEqual([
          { id: `s-${section.id}-${schedule.id}`, sectionJwId: section.jwId },
        ]);
        expect(
          result.overview?.calendar.allExams.map((item) => item.id),
        ).toEqual([`e-${section.id}-${exam.id}`]);
        expect(
          result.overview?.calendar.semesterHomeworks.map((item) => item.id),
        ).toEqual(["navigation-viewer-pending"]);
        expect(
          result.overview?.calendar.semesterTodos.map((item) => item.id),
        ).toEqual(["navigation-viewer-dated"]);
      }
      expect(calendarData.overview?.calendar).toMatchObject({
        semesterStart: "2026-04-01",
        semesterEnd: "2026-07-31",
        activeCalendarSemesterId: semester.id,
      });
    });
  });
});
