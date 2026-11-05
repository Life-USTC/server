import { expect } from "vitest";
import { getSubscriptionsTabData } from "@/features/subscriptions/server/subscription-tab-read-model";
import { loadSignedWorkspacePageData } from "@/features/workspace/server/workspace-page-load-signed";
import { getWorkspaceUserContext } from "@/features/workspace/server/workspace-user-context";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { nodeProtocolTest as test } from "../shared/node-protocol-fixture";

test("subscription.request-membership-reuse", {
  tags: ["@Subscription/Service"],
}, async ({ isolatedDatabase: { owner: db }, protocolRuntime }) => {
  const users = ["membership-viewer", "membership-other"];
  await db.user.createMany({
    data: users.map((id) => ({ id, email: `${id}@example.test` })),
  });
  const course = await db.course.create({
    data: {
      jwId: 1865001,
      code: "MEMBERSHIP",
      nameCn: "订阅身份",
      nameEn: "Membership",
    },
  });
  const semester = await db.semester.create({
    data: {
      jwId: 1865001,
      code: "2026-member",
      nameCn: "测试学期",
      startDate: new Date("2026-02-01T00:00:00Z"),
      endDate: new Date("2026-07-31T00:00:00Z"),
    },
  });
  const sections = await Promise.all(
    [1, 2, 3].map((index) =>
      db.section.create({
        data: {
          jwId: 1865000 + index,
          code: `MEMBERSHIP.0${index}`,
          courseId: course.id,
          semesterId: semester.id,
        },
      }),
    ),
  );
  await db.userSectionSubscription.createMany({
    data: [
      { userId: users[0], sectionId: sections[0].id, kind: "regular" },
      {
        userId: users[0],
        sectionId: sections[1].id,
        kind: "teaching_assistant",
      },
      { userId: users[1], sectionId: sections[2].id, kind: "auditor" },
    ],
  });
  await db.exam.createMany({
    data: sections.map((section, index) => ({
      jwId: 1865000 + index,
      sectionId: section.id,
      examDate: new Date("2026-06-29T00:00:00Z"),
      startTime: 900,
      endTime: 1100,
    })),
  });
  const observed = await protocolRuntime.run(async () => {
    const [context, otherContext] = await Promise.all(
      users.map((userId) => getWorkspaceUserContext(userId)),
    );
    if (!context?.subscriptionKinds || !otherContext?.subscriptionKinds)
      throw new Error("Missing membership snapshot");
    expect(getUserRlsTransactionClient()).toBeUndefined();
    const options = {
      sectionIds: sections.map((section) => section.id),
      includeExams: true,
    };
    const [reused, fallback, mismatched, page] = await Promise.all([
      getSubscriptionsTabData(users[0], "en-us", {
        ...options,
        subscriptionKinds: context.subscriptionKinds,
      }),
      getSubscriptionsTabData(users[0], "en-us", options),
      getSubscriptionsTabData(users[0], "en-us", {
        ...options,
        subscriptionKinds: otherContext.subscriptionKinds,
      }),
      loadSignedWorkspacePageData({
        calendarSemesterId: undefined,
        locale: "en-us",
        overviewWeek: null,
        pageCopy: getWorkspacePageCopy("en-us"),
        referenceNow: new Date("2026-04-29T01:30:00Z"),
        requestId: "membership-reuse",
        tab: "exams",
        userId: users[0],
      }),
    ]);
    expect(getUserRlsTransactionClient()).toBeUndefined();
    return { reused, fallback, mismatched, page };
  });
  for (const result of [
    observed.reused,
    observed.fallback,
    observed.mismatched,
    observed.page.subscriptions,
  ]) {
    expect(result).toBeTruthy();
    expect(
      result?.subscriptions.flatMap((subscription) =>
        subscription.sections.map((section) => ({
          id: section.id,
          kind: section.kind,
          exams: section.exams.length,
        })),
      ),
    ).toEqual([
      { id: sections[0].id, kind: "regular", exams: 1 },
      { id: sections[1].id, kind: "teaching_assistant", exams: 1 },
    ]);
    expect(result?.calendarSubscriptionUrl).toBeNull();
  }
  expect(observed.page.navStats?.user.id).toBe(users[0]);
  expect(observed.page.subscribedSectionCount).toBe(2);
  expect(observed.page.navStats?.examsCount).toBe(2);
  expect(observed.page).not.toHaveProperty("subscriptionKinds");
  expect(
    await db.userSectionSubscription.findMany({
      orderBy: { sectionId: "asc" },
      select: { userId: true, sectionId: true, kind: true },
    }),
  ).toEqual(
    [
      { userId: users[0], sectionId: sections[0].id, kind: "regular" },
      {
        userId: users[0],
        sectionId: sections[1].id,
        kind: "teaching_assistant",
      },
      { userId: users[1], sectionId: sections[2].id, kind: "auditor" },
    ].sort((left, right) => left.sectionId - right.sectionId),
  );
});
