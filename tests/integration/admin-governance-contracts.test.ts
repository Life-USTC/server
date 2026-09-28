import { expect } from "vitest";
import { moderateCommentAction } from "@/features/admin/server/admin-moderation-action-handlers";
import { getAdminDemotionFailure } from "@/features/admin/server/admin-role-change";
import { getAdminUsersPage } from "@/features/admin/server/admin-users-page-data";
import { patchAdminCommentRoute } from "@/lib/api/routes/admin-comment-update-route";
import { getAdminCommentsRoute } from "@/lib/api/routes/admin-comments-list-route";
import { getAdminDescriptionsRoute } from "@/lib/api/routes/admin-descriptions";
import { getAdminHomeworksRoute } from "@/lib/api/routes/admin-homeworks-list-route";
import {
  getAdminSuspensionsRoute,
  patchAdminSuspensionRoute,
  postAdminSuspensionRoute,
} from "@/lib/api/routes/admin-suspensions";
import {
  getAdminUsersRoute,
  patchAdminUserRoute,
} from "@/lib/api/routes/admin-users";
import { findActiveSuspension } from "@/lib/auth/viewer-context";
import { adminGovernanceTest as it } from "../shared/admin-governance-fixture";

const lists = [
  { path: "/api/admin/users", run: getAdminUsersRoute },
  { path: "/api/admin/comments", run: getAdminCommentsRoute },
  { path: "/api/admin/descriptions", run: getAdminDescriptionsRoute },
  { path: "/api/admin/homeworks", run: getAdminHomeworksRoute },
];

it("admin.admin-rest-session-only", async ({ governance }) => {
  const { run, request, token, cookie, userCookie, db, userId, marker } =
    governance;
  const routes = [
    ...lists,
    { path: "/api/admin/suspensions", run: getAdminSuspensionsRoute },
  ];
  for (const route of routes) {
    for (const headers of [
      {},
      { authorization: `Bearer ${token}` },
      { authorization: `Bearer ${token}`, cookie },
      { cookie: userCookie },
    ] as Record<string, string>[]) {
      expect(
        (
          await run(() =>
            route.run(request(route.path, "GET", undefined, headers)),
          )
        ).status,
        route.path,
      ).toBe(401);
    }
    expect(
      (await run(() => route.run(request(route.path)))).status,
      route.path,
    ).toBe(200);
  }
  for (const headers of [
    { authorization: `Bearer ${token}` },
    { authorization: `Bearer ${token}`, cookie },
  ] as Record<string, string>[]) {
    const response = await run(() =>
      patchAdminUserRoute(
        request(
          `/api/admin/users/${userId}`,
          "PATCH",
          { name: "bearer update" },
          headers,
        ),
        { id: userId },
      ),
    );
    expect(response.status).toBe(401);
  }
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: userId } })).name,
  ).toBe(`${marker}-${userId}`);
});

it("admin.paginated-moderation-lists", async ({ governance }) => {
  const { run, request } = governance;
  for (const route of lists) {
    const first = await run(() =>
      route.run(request(`${route.path}?page=1&pageSize=1`)),
    );
    const second = await run(() =>
      route.run(request(`${route.path}?page=2&pageSize=1`)),
    );
    expect(first.status, route.path).toBe(200);
    expect(second.status, route.path).toBe(200);
    const a = await first.json();
    const b = await second.json();
    expect(Object.keys(a).sort()).toEqual(["data", "pagination"]);
    expect(a.data).toHaveLength(1);
    expect(b.data).toHaveLength(1);
    expect(a.data[0].id).not.toBe(b.data[0].id);
    expect(a.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });
    expect(b.pagination).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });
    expect(a.pagination.total).toBe(3);
    const beyond = await run(() =>
      route.run(request(`${route.path}?page=100000&pageSize=1`)),
    );
    expect((await beyond.json()).data).toEqual([]);
    for (const suffix of [
      "limit=1",
      "pageSize=1&limit=1",
      "pageSize=0",
      "pageSize=201",
    ]) {
      expect(
        (await run(() => route.run(request(`${route.path}?${suffix}`)))).status,
        `${route.path}?${suffix}`,
      ).toBe(400);
    }
  }
});

it("admin.suspended-admin-write-gate", async ({ governance }) => {
  const {
    run,
    request,
    db,
    adminId,
    userId,
    commentIds,
    marker,
    origin,
    cookie,
  } = governance;
  const suspension = await db.userSuspension.create({
    data: { userId: adminId, reason: "Governance suspended" },
  });
  try {
    for (const route of lists.filter(
      (route) => route.path !== "/api/admin/comments",
    )) {
      expect(
        (await run(() => route.run(request(`${route.path}?page=1&pageSize=1`))))
          .status,
        route.path,
      ).toBe(200);
    }
    expect(
      (
        await run(() =>
          getAdminSuspensionsRoute(request("/api/admin/suspensions")),
        )
      ).status,
    ).toBe(200);
    const pageRequest = request("/admin/users");
    expect(
      await run(() => getAdminUsersPage(pageRequest, new URL(pageRequest.url))),
    ).toHaveProperty("users");
    const responses = [
      await run(() => getAdminCommentsRoute(request("/api/admin/comments"))),
      await run(() =>
        patchAdminUserRoute(
          request(`/api/admin/users/${userId}`, "PATCH", {
            name: "must not persist",
          }),
          { id: userId },
        ),
      ),
      await run(() =>
        patchAdminCommentRoute(
          request(`/api/admin/comments/${commentIds[0]}`, "PATCH", {
            status: "deleted",
          }),
          { id: commentIds[0] },
        ),
      ),
      await run(() =>
        postAdminSuspensionRoute(
          request("/api/admin/suspensions", "POST", { userId }),
        ),
      ),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: "Suspended",
        reason: "Governance suspended",
      });
    }
    const form = new FormData();
    form.set("id", commentIds[0]);
    form.set("status", "deleted");
    await expect(
      run(() =>
        moderateCommentAction({
          locals: { locale: "en-us", requestId: marker },
          request: new Request(`${origin}/admin/moderation`, {
            method: "POST",
            headers: { cookie, origin },
            body: form,
          }),
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await db.comment.findUniqueOrThrow({ where: { id: commentIds[0] } }))
        .status,
    ).toBe("active");
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: userId } })).name,
    ).toBe(`${marker}-${userId}`);
  } finally {
    await db.userSuspension.update({
      where: { id: suspension.id },
      data: { liftedAt: new Date() },
    });
  }
  const active = await run(() =>
    patchAdminUserRoute(
      request(`/api/admin/users/${userId}`, "PATCH", { name: "restored" }),
      { id: userId },
    ),
  );
  expect(active.status).toBe(200);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: userId } })).name,
  ).toBe("restored");
});

it("admin.single-open-suspension", async ({ governance }) => {
  const { run, request, db, adminId, secondUserId } = governance;
  const responses = await Promise.all(
    ["first", "second"].map((reason) =>
      run(() =>
        postAdminSuspensionRoute(
          request("/api/admin/suspensions", "POST", {
            userId: secondUserId,
            reason,
          }),
        ),
      ),
    ),
  );
  for (const response of responses)
    expect(response.status, await response.text()).toBe(201);
  const history = await db.userSuspension.findMany({
    where: { userId: secondUserId },
    orderBy: { createdAt: "asc" },
  });
  expect(history).toHaveLength(2);
  expect(history.filter((row) => row.liftedAt === null)).toHaveLength(1);
  expect(history.filter((row) => row.liftedAt !== null)[0].liftedById).toBe(
    adminId,
  );
  const open = history.find((row) => row.liftedAt === null);
  if (!open) throw new Error("Expected one remaining open suspension");
  expect((await run(() => findActiveSuspension(secondUserId)))?.id).toBe(
    open.id,
  );
  const lifted = await run(() =>
    patchAdminSuspensionRoute(
      request(`/api/admin/suspensions/${open.id}`, "PATCH"),
      { id: open.id },
    ),
  );
  expect(lifted.status).toBe(200);
  expect(await run(() => findActiveSuspension(secondUserId))).toBeNull();
  expect(
    await db.userSuspension.count({ where: { userId: secondUserId } }),
  ).toBe(2);
  expect(
    await db.userSuspension.count({
      where: { userId: secondUserId, liftedAt: null },
    }),
  ).toBe(0);
});

it("admin.admin-mutation-not-found", async ({ governance }) => {
  const { run, request, db, adminId, marker } = governance;
  const id = `missing-${marker}`;
  const responses = [
    await run(() =>
      patchAdminUserRoute(
        request(`/api/admin/users/${id}`, "PATCH", { name: "missing" }),
        { id },
      ),
    ),
    await run(() =>
      postAdminSuspensionRoute(
        request("/api/admin/suspensions", "POST", { userId: id }),
      ),
    ),
    await run(() =>
      patchAdminCommentRoute(
        request(`/api/admin/comments/${id}`, "PATCH", { status: "deleted" }),
        { id },
      ),
    ),
  ];
  for (const response of responses) expect(response.status).toBe(404);
  expect(
    await db.auditLog.count({ where: { userId: adminId, targetId: id } }),
  ).toBe(0);
});

it("admin.admin-self-protection", async ({ governance }) => {
  const { run, request, db, app, adminId, secondUserId } = governance;
  const responses = [
    await run(() =>
      patchAdminUserRoute(
        request(`/api/admin/users/${adminId}`, "PATCH", { isAdmin: false }),
        { id: adminId },
      ),
    ),
    await run(() =>
      postAdminSuspensionRoute(
        request("/api/admin/suspensions", "POST", { userId: adminId }),
      ),
    ),
  ];
  for (const response of responses) expect(response.status).toBe(400);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: adminId } })).isAdmin,
  ).toBe(true);
  expect(
    await db.userSuspension.count({
      where: { userId: adminId, liftedAt: null },
    }),
  ).toBe(0);
  const existing = await db.user.findMany({
    where: { isAdmin: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  expect(existing).toEqual([{ id: adminId }]);
  await app.$transaction(
    async (tx) => {
      // Count the case-owned population through a real restricted connection;
      // no owner connection, SET ROLE, or shared-population rollback.
      expect(await tx.$queryRaw`SELECT current_user AS role`).toEqual([
        { role: "life_ustc_runtime" },
      ]);
      expect(await getAdminDemotionFailure(tx, secondUserId, adminId)).toBe(
        "cannot_remove_last_admin",
      );
      expect(await getAdminDemotionFailure(tx, adminId, adminId)).toBe(
        "cannot_demote_self",
      );
      expect(await tx.user.count({ where: { isAdmin: true } })).toBe(1);
    },
    { isolationLevel: "Serializable" },
  );
  expect(
    await db.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
  ).toEqual(existing);
});
