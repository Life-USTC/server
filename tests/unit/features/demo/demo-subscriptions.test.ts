import { expect, it } from "vitest";
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import { getDemoSubscription } from "@/features/demo/server/demo-subscriptions";
import {
  getDemoNavigation,
  getDemoWorkspacePage,
} from "@/features/demo/server/demo-workspace";
import { currentCalendarSubscriptionResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";

const identity: DemoIdentity = {
  fixtureVersion: "workspace-v1",
  expiresAt: 1_790_212_500_000,
};

it.each(["zh-cn", "en-us"] as const)(
  "projects the same fixed subscriptions into %s page, API and navigation",
  (locale) => {
    const subscription = getDemoSubscription(identity, locale);
    expect(
      currentCalendarSubscriptionResponseSchema.parse({ subscription }),
    ).toEqual({ subscription });
    expect(subscription.userId).toBe("demo:workspace-v1");
    expect(subscription.calendarPath).toBeNull();
    expect(subscription.calendarUrl).toBeNull();
    expect(
      subscription.sections.map(({ jwId, kind, semester, credits }) => ({
        jwId,
        kind,
        semester: semester?.id,
        credits,
      })),
    ).toEqual([
      { jwId: 910001, kind: "regular", semester: 2609, credits: 4 },
      { jwId: 910002, kind: "auditor", semester: 2609, credits: 3 },
      {
        jwId: 910003,
        kind: "teaching_assistant",
        semester: 2602,
        credits: 3.5,
      },
    ]);
    expect(
      subscription.sections.map(({ course }) => course.namePrimary),
    ).toEqual(
      locale === "en-us"
        ? ["Linear Algebra", "College Physics", "Data Structures"]
        : ["线性代数", "大学物理", "数据结构"],
    );
    const page = getDemoWorkspacePage(identity, locale, "subscriptions");
    expect(page.referenceNow).toBe("2026-09-24T09:00:00+08:00");
    expect(page.subscriptions?.currentSemesterId).toBe(2609);
    expect(page.subscriptions?.calendarSubscriptionUrl).toBeNull();
    expect(
      page.subscriptions?.subscriptions[0].sections.map(
        ({ jwId, course, teachers }) => ({
          jwId,
          name: course.namePrimary,
          teachers,
        }),
      ),
    ).toEqual(
      subscription.sections.map(({ jwId, course, teachers }) => ({
        jwId,
        name: course.namePrimary,
        teachers: teachers.map(({ namePrimary }) => ({ namePrimary })),
      })),
    );
    expect(getDemoNavigation(identity)).toMatchObject({
      subscribedSectionCount: 3,
      pendingTodosCount: 2,
    });
    expect(getDemoWorkspacePage(identity, locale, "todos").todos).toHaveLength(
      3,
    );
  },
);

it("does not retain changes to a returned sample", () => {
  const subscription = getDemoSubscription(identity, "en-us");
  subscription.sections[0].course.namePrimary = "changed";
  subscription.sections[0].teachers[0].namePrimary = "changed";
  subscription.sections.splice(1);
  const fresh = getDemoSubscription(identity, "en-us");
  expect(fresh.sections).toHaveLength(3);
  expect(fresh.sections[0].course.namePrimary).toBe("Linear Algebra");
  expect(
    fresh.sections[0].teachers.map(({ namePrimary }) => namePrimary),
  ).toEqual(["Teacher Chen", "Teacher Lin"]);
});
