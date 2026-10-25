import { expect } from "vitest";
import { getAdminModerationPage } from "@/features/admin/server/admin-moderation-page-data";
import { getAdminUsersPage } from "@/features/admin/server/admin-users-page-data";
import { adminGovernanceTest as it } from "../shared/admin-governance-fixture";

it("admin.user-pages-stay-disjoint-for-equal-created-at", {
  tags: ["@Admin/Web"],
}, async ({ governance }) => {
  const { db, run, request } = governance;
  const users = Array.from({ length: 21 }, (_, index) => ({
    id: `stable-page-${String(index).padStart(2, "0")}`,
    name: `Stable pagination member ${index}`,
    email: `stable-page-${index}@example.test`,
    createdAt: new Date(index === 0 ? "2026-01-01" : "2020-01-01"),
  }));
  await db.user.createMany({ data: users });
  const expectedIds = users.map((user) => user.id);
  let initialOrder: string[] = [];
  for (const updated of [false, true]) {
    if (updated)
      await db.user.update({
        where: { id: users[0].id },
        data: { name: "Stable pagination member updated" },
      });
    const pages = [];
    for (const page of [1, 2]) {
      const req = request(
        `/admin/users?search=Stable+pagination+member&page=${page}`,
      );
      pages.push(await run(() => getAdminUsersPage(req, new URL(req.url))));
    }
    expect(pages.map((page) => page.users.length)).toEqual([20, 1]);
    const ids = pages.flatMap((page) => page.users.map((user) => user.id));
    expect([...ids].sort()).toEqual(expectedIds);
    if (updated) {
      expect([...initialOrder.slice(0, 20), ...ids.slice(20)].sort()).toEqual(
        expectedIds,
      );
      expect(ids).toEqual(initialOrder);
    } else initialOrder = ids;
    expect(pages[0].users[0].name).toBe(
      updated ? "Stable pagination member updated" : users[0].name,
    );
  }
});

it("admin.table-column-filters-before-limits", {
  tags: ["@Admin/Web"],
}, async ({ governance }) => {
  const { db, userId, commentIds, run, request } = governance;
  const old = new Date("2020-01-01T00:00:00Z");
  const recent = new Date("2026-10-24T00:00:00Z");
  const homework = await db.homework.findFirstOrThrow();
  const description = await db.description.findFirstOrThrow();
  await db.comment.update({
    where: { id: commentIds[0] },
    data: {
      body: "Historical matching comment",
      status: "softbanned",
      createdAt: old,
    },
  });
  await db.comment.createMany({
    data: Array.from({ length: 51 }, (_, index) => ({
      id: `new-comment-${index}`,
      userId,
      homeworkId: homework.id,
      body: "Recent nonmatching comment",
      status: "softbanned" as const,
      createdAt: recent,
    })),
  });
  await db.description.update({
    where: { id: description.id },
    data: {
      content: "Historical matching description",
      updatedAt: old,
      lastEditedAt: null,
      lastEditedById: userId,
    },
  });
  for (let index = 0; index < 201; index++) {
    await db.course.create({
      data: {
        jwId: 1000 + index,
        code: `recent-${index}`,
        nameCn: "Recent course",
        description: {
          create: {
            content: "Recent nonmatching description",
            updatedAt: recent,
            lastEditedAt: recent,
          },
        },
      },
    });
  }
  await db.homework.update({
    where: { id: homework.id },
    data: {
      title: "Historical matching homework",
      createdAt: old,
      deletedAt: old,
      submissionDueAt: new Date("2020-01-03T00:00:00Z"),
    },
  });
  await db.homework.createMany({
    data: Array.from({ length: 51 }, () => ({
      sectionId: homework.sectionId,
      title: "Recent nonmatching homework",
      createdById: userId,
      createdAt: recent,
      deletedAt: recent,
    })),
  });
  const suspension = await db.userSuspension.create({
    data: {
      userId,
      reason: "Historical matching suspension",
      createdAt: old,
      liftedAt: old,
    },
  });
  await db.userSuspension.createMany({
    data: Array.from({ length: 51 }, () => ({
      userId,
      reason: "Recent nonmatching suspension",
      createdAt: recent,
      liftedAt: recent,
    })),
  });

  for (const [tab, filter, expectedId] of [
    [
      "comments",
      `status=active,softbanned&content=Historical&createdAt=2020-01-01&author=${userId}`,
      commentIds[0],
    ],
    [
      "descriptions",
      `descriptionContent=withContent,empty&content=Historical&editedAt=2020-01-01&author=${userId}`,
      description.id,
    ],
    [
      "homeworks",
      `status=active,deleted&content=Historical&dueAt=2020-01-02&dueAtOp=gt&author=${userId}`,
      homework.id,
    ],
    [
      "suspensions",
      `status=lifted&reason=Historical&permanent=true&author=${userId}`,
      suspension.id,
    ],
  ] as const) {
    const req = request(`/admin/moderation?tab=${tab}&${filter}`);
    const result = await run(() =>
      getAdminModerationPage(req, new URL(req.url)),
    );
    expect(
      result[tab].map((item) => item.id),
      tab,
    ).toEqual([expectedId]);
  }
});

it("admin.user-column-filters-preserve-count-and-pages", {
  tags: ["@Admin/Web"],
}, async ({ governance }) => {
  const { db, run, request } = governance;
  const users = Array.from({ length: 25 }, (_, index) => ({
    id: `filtered-user-${index}`,
    name: "Matching table member",
    email: `member-${index}@example.test`,
    createdAt: new Date(`2020-01-01T00:00:${String(index).padStart(2, "0")}Z`),
  }));
  await db.user.createMany({
    data: [
      ...users,
      {
        id: "wrong-role",
        name: "Matching table member",
        email: "wrong-role@example.test",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        isAdmin: true,
      },
      {
        id: "wrong-day",
        name: "Matching table member",
        email: "wrong-day@example.test",
        createdAt: new Date("2020-01-01T16:00:00Z"),
      },
    ],
  });
  const ids: string[] = [];
  for (const page of [1, 2]) {
    const req = request(
      `/admin/users?name=Matching&role=user&createdAt=2020-01-01&page=${page}`,
    );
    const result = await run(() => getAdminUsersPage(req, new URL(req.url)));
    expect(result.pagination).toMatchObject({ total: 25, totalPages: 2, page });
    expect(result.users).toHaveLength(page === 1 ? 20 : 5);
    ids.push(...result.users.map((user) => user.id));
  }
  expect(new Set(ids)).toEqual(new Set(users.map((user) => user.id)));
});

it("admin.user-name-filter-matches-display-fallback", {
  tags: ["@Admin/Web"],
}, async ({ governance }) => {
  const { db, run, request } = governance;
  await db.user.createMany({
    data: [
      {
        id: "hidden-named-id",
        name: "Visible name",
        username: "hidden-named-user",
        email: "hidden-named-email@example.test",
      },
      {
        id: "hidden-default-name-id",
        username: "fallback-default-user",
        email: "hidden-default-name-email@example.test",
      },
      {
        id: "hidden-empty-name-id",
        name: "",
        username: "fallback-empty-user",
        email: "hidden-empty-name-email@example.test",
      },
      {
        id: "hidden-null-username-id",
        name: "",
        username: null,
        email: "fallback-null-email@example.test",
      },
      {
        id: "hidden-empty-username-id",
        name: "",
        username: "",
        email: "fallback-empty-email@example.test",
      },
      {
        id: "fallback-visible-id",
        name: "",
        username: null,
        email: "",
      },
    ],
  });
  const cases: Array<[Record<string, string>, string[]]> = [
    [{ name: "VISIBLE NAME" }, ["hidden-named-id"]],
    [{ name: "FALLBACK-DEFAULT-USER" }, ["hidden-default-name-id"]],
    [{ name: "fallback-empty-user" }, ["hidden-empty-name-id"]],
    [{ name: "fallback-null-email" }, ["hidden-null-username-id"]],
    [{ name: "fallback-empty-email" }, ["hidden-empty-username-id"]],
    [{ name: "fallback-visible-id" }, ["fallback-visible-id"]],
    [{ name: "hidden-" }, []],
    [{ username: "hidden-named-user" }, ["hidden-named-id"]],
    [{ email: "hidden-named-email" }, ["hidden-named-id"]],
    [{ email: "hidden-default-name-email" }, ["hidden-default-name-id"]],
    [
      { name: "fallback-default-user", email: "hidden-default-name-email" },
      ["hidden-default-name-id"],
    ],
  ];
  for (const [filters, expectedIds] of cases) {
    const req = request(`/admin/users?${new URLSearchParams(filters)}`);
    const result = await run(() => getAdminUsersPage(req, new URL(req.url)));
    expect(
      result.users.map((user) => user.id),
      JSON.stringify(filters),
    ).toEqual(expectedIds);
    expect(result.pagination.total).toBe(expectedIds.length);
  }
});
