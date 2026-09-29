import { createLocalAccountIssuer } from "@better-auth/core/db";
import type { Prisma } from "../../../src/generated/prisma-node/client";
import scenario from "../fixtures/scenario.json" with { type: "json" };
import {
  createVisualCourseCatalog,
  createVisualWorkspaceCatalog,
} from "../visual-matrix/catalog-fixture";

export type MobileRole = "user" | "admin";

/** Private populated state for the existing mobile route consumers. */
export async function createMobilePageState(
  db: Prisma.TransactionClient,
  role: MobileRole,
  incompleteProfile: boolean,
  origin: string,
  password: string,
) {
  const identity =
    role === "admin" ? scenario.users.admin : scenario.users.debug;
  const account = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name: incompleteProfile ? "" : identity.name,
      username: incompleteProfile ? null : identity.username,
      email: `${identity.username}@mobile.test`,
      emailVerified: true,
      isAdmin: role === "admin",
      image: new URL("/images/icon.png", origin).href,
    },
  });
  await db.account.create({
    data: {
      userId: account.id,
      type: "credential",
      provider: "credential",
      issuer: createLocalAccountIssuer("credential"),
      providerAccountId: account.id,
      password,
    },
  });
  // Welcome starts with an incomplete private profile; no common user is reset.
  if (incompleteProfile) return account;

  const courses = await createVisualCourseCatalog(db);
  await createVisualWorkspaceCatalog(db, courses);
  // Keep the populated current-semester consumer available as the clock advances.
  await db.semester.update({
    where: { jwId: scenario.semester.jwId },
    data: { endDate: new Date(Date.now() + 180 * 86_400_000) },
  });
  const sections = await db.section.findMany({ orderBy: { jwId: "asc" } });
  if (sections.length !== scenario.sections.length)
    throw new Error("Private mobile catalog is incomplete");
  await db.userSectionSubscription.createMany({
    data: sections.map((section) => ({
      userId: account.id,
      sectionId: section.id,
    })),
  });
  const completed = await db.homework.findMany({
    where: {
      title: { in: [scenario.homeworks.completedTitle, "线性变换证明题"] },
    },
  });
  if (completed.length !== 2)
    throw new Error("Private mobile completed homework state is incomplete");
  await db.homeworkCompletion.createMany({
    data: completed.map((homework) => ({
      userId: account.id,
      homeworkId: homework.id,
    })),
  });
  await db.todo.createMany({
    data: [
      {
        title: scenario.todos.overdueTitle,
        content: "用于验证逾期待办展示",
        priority: "high" as const,
        completed: false,
        dueAt: new Date("2026-04-28T01:00:00Z"),
      },
      {
        title: scenario.todos.dueTodayTitle,
        content: "需今日完成",
        priority: "high" as const,
        completed: false,
        dueAt: new Date("2026-04-29T15:59:00Z"),
      },
      {
        title: "三天内复习安排",
        priority: "medium" as const,
        completed: false,
        dueAt: new Date("2026-05-01T10:00:00Z"),
      },
      {
        title: "下周小组展示准备",
        priority: "low" as const,
        completed: false,
        dueAt: new Date("2026-05-06T15:59:00Z"),
      },
      {
        title: "整理课程资料",
        priority: "medium" as const,
        completed: false,
        dueAt: null,
      },
      {
        title: scenario.todos.completedTitle,
        priority: "high" as const,
        completed: true,
        dueAt: new Date("2026-04-28T12:00:00Z"),
      },
    ].map((todo) => ({ ...todo, userId: account.id })),
  });
  await db.workspaceLinkPin.createMany({
    data: scenario.catalogLinks.pinnedSlugs.map((slug) => ({
      userId: account.id,
      slug,
    })),
  });
  await db.catalogLinkClick.createMany({
    data: scenario.catalogLinks.clickedSlugs.map(({ slug, count }, index) => ({
      userId: account.id,
      slug,
      count,
      lastClickedAt: new Date(`2026-04-29T0${index + 2}:00:00Z`),
    })),
  });
  const comment = await db.comment.create({
    data: {
      sectionId: sections[0].id,
      userId: account.id,
      body: scenario.comments.sectionRootBody,
      visibility: "public",
    },
  });
  await db.comment.create({
    data: {
      sectionId: sections[0].id,
      userId: account.id,
      parentId: comment.id,
      rootId: comment.id,
      body: "回复：推荐先写测试用例再实现。",
      visibility: "logged_in_only",
    },
  });
  const event = await db.youngEvent.create({
    data: {
      youngId: scenario.youngEvent.youngId,
      name: scenario.youngEvent.name,
      category: scenario.youngEvent.category,
      location: scenario.youngEvent.location,
      organizer: scenario.youngEvent.organizer,
      isActive: true,
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      rawJson: {},
    },
  });
  await db.userYoungEventSubscription.create({
    data: { userId: account.id, youngId: event.youngId, observedState: "{}" },
  });

  if (role === "admin") {
    const member = await db.user.create({
      data: {
        name: scenario.users.debug.name,
        username: scenario.users.debug.username,
        email: "mobile-member@example.test",
        emailVerified: true,
      },
    });
    await db.userSuspension.create({
      data: {
        userId: member.id,
        createdById: account.id,
        reason: scenario.suspensions.reasonKeyword,
      },
    });
    await db.oAuthClient.create({
      data: {
        clientId: "mobile-calendar-client",
        name: "移动端日历客户端",
        redirectUris: [new URL("/oauth/callback", origin).href],
        scopes: ["profile", "calendar:read"],
        public: true,
        tokenEndpointAuthMethod: "none",
        grantTypes: ["authorization_code"],
        responseTypes: ["code"],
        requirePKCE: true,
      },
    });
    const campuses = [
      { id: 1, name: "东区", latitude: 31.83892, longitude: 117.268264 },
      { id: 2, name: "西区", latitude: 31.839258, longitude: 117.256645 },
      { id: 5, name: "先研院", latitude: 31.826345, longitude: 117.129257 },
      { id: 6, name: "高新", latitude: 31.820447, longitude: 117.129369 },
    ];
    await db.busCampus.createMany({
      data: campuses.map(({ name, ...campus }) => ({
        ...campus,
        nameCn: name,
      })),
    });
    const route = { id: scenario.bus.routeId, campuses };
    await db.busRoute.create({
      data: {
        id: route.id,
        nameCn: scenario.bus.recommendedRoute,
        stops: {
          create: campuses.map((campus, stopOrder) => ({
            campusId: campus.id,
            stopOrder,
          })),
        },
      },
    });
    for (const index of [0, 1]) {
      const version = await db.busScheduleVersion.create({
        data: {
          key: `mobile-timetable-${index}`,
          checksum: `mobile-timetable-checksum-${index}`,
          title: `${scenario.bus.versionTitle}${index === 0 ? "" : " (previous)"}`,
          isEnabled: index === 0,
          effectiveFrom: new Date("2020-01-01"),
          rawJson: {
            campuses,
            routes: [route],
            weekday_routes: [
              { id: 1, route, time: [["08:00", "08:05", "08:40", "08:50"]] },
            ],
            saturday_routes: [],
            sunday_routes: [],
          },
        },
      });
      await db.busTrip.create({
        data: {
          versionId: version.id,
          routeId: route.id,
          dayType: "weekday",
          position: 0,
          stopTimes: ["08:00", "08:05", "08:40", "08:50"],
        },
      });
    }
  }
  return account;
}
