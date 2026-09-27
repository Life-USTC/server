import { getAdminDemotionFailure } from "@/features/admin/server/admin-role-change";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { moderateCommentAction } from "@/features/admin/server/admin-moderation-action-handlers";
import { getAdminUsersPage } from "@/features/admin/server/admin-users-page-data";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
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
import { getBetterAuthInstance } from "@/lib/auth/core";
import { findActiveSuspension } from "@/lib/auth/viewer-context";
import { getCanonicalOAuthIssuer } from "@/lib/oauth/resource-urls";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const adminId = `governance-admin-${marker}`;
const userId = `governance-user-${marker}`;
const secondUserId = `governance-second-${marker}`;
const clientId = `governance-client-${marker}`;
const origin = "http://localhost:3000";
const homeworkIds: string[] = [];
const commentIds: string[] = [];
let cookie: string;
let userCookie: string;
let token: string;
async function sessionCookie(id: string) {
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: id,
      sessionToken: token,
      expires: new Date(Date.now() + 3_600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
}
function request(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = { cookie },
) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      origin,
      ...headers,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const lists = [
  { path: "/api/admin/users", run: getAdminUsersRoute },
  { path: "/api/admin/comments", run: getAdminCommentsRoute },
  { path: "/api/admin/descriptions", run: getAdminDescriptionsRoute },
  { path: "/api/admin/homeworks", run: getAdminHomeworksRoute },
];
beforeAll(async () => {
  for (const id of [adminId, userId, secondUserId])
    await db.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        name: `${marker}-${id}`,
        isAdmin: id === adminId,
      },
    });
  cookie = await sessionCookie(adminId);
  userCookie = await sessionCookie(userId);
  const client = await db.oAuthClient.create({
    data: {
      clientId,
      name: "Governance bearer",
      tokenEndpointAuthMethod: "none",
      scopes: ["workspace.todo:read"],
      consents: {
        create: {
          userId: adminId,
          scopes: ["workspace.todo:read"],
          resources: [getCanonicalOAuthIssuer()],
        },
      },
    },
    include: { consents: true },
  });
  token = (await signResourceBoundOAuthAccessToken({
    clientId,
    userId: adminId,
    grantId: client.consents[0].grantId,
    resources: [getCanonicalOAuthIssuer()],
    scopes: ["workspace.todo:read"],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 600,
  }))!;
  const section = await db.section.findFirstOrThrow();
  for (let index = 0; index < 3; index++) {
    const homework = await db.homework.create({
      data: {
        title: `${marker}-${index}`,
        sectionId: section.id,
        createdById: userId,
        description: { create: { content: `${marker}-${index}` } },
      },
    });
    homeworkIds.push(homework.id);
    const comment = await db.comment.create({
      data: { body: `${marker}-${index}`, userId, homeworkId: homework.id },
    });
    commentIds.push(comment.id);
  }
});
afterAll(async () => {
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { userId: adminId },
        { subjectUserId: { in: [adminId, userId, secondUserId] } },
      ],
    },
  });
  await db.homework.deleteMany({ where: { id: { in: homeworkIds } } });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({
    where: { id: { in: [adminId, userId, secondUserId] } },
  });
  await db.$disconnect();
});

it("admin.admin-rest-session-only", async () => {
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
        (await route.run(request(route.path, "GET", undefined, headers)))
          .status,
        route.path,
      ).toBe(401);
    }
    expect((await route.run(request(route.path))).status, route.path).toBe(200);
  }
  for (const headers of [
    { authorization: `Bearer ${token}` },
    { authorization: `Bearer ${token}`, cookie },
  ] as Record<string, string>[]) {
    const response = await patchAdminUserRoute(
      request(
        `/api/admin/users/${userId}`,
        "PATCH",
        { name: "bearer update" },
        headers,
      ),
      { id: userId },
    );
    expect(response.status).toBe(401);
  }
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: userId } })).name,
  ).toBe(`${marker}-${userId}`);
});

it("admin.paginated-moderation-lists", async () => {
  for (const route of lists) {
    const first = await route.run(request(`${route.path}?page=1&pageSize=1`));
    const second = await route.run(request(`${route.path}?page=2&pageSize=1`));
    expect(first.status, route.path).toBe(200);
    expect(second.status, route.path).toBe(200);
    const a = await first.json();
    const b = await second.json();
    expect(Object.keys(a).sort()).toEqual(["data", "pagination"]);
    expect(a.data).toHaveLength(1);
    expect(b.data).toHaveLength(1);
    expect(a.data[0].id).not.toBe(b.data[0].id);
    expect(a.pagination).toMatchObject({ page: 1, pageSize: 1 });
    expect(b.pagination).toMatchObject({
      page: 2,
      pageSize: 1,
      total: a.pagination.total,
      totalPages: a.pagination.total,
    });
    expect(a.pagination.total).toBeGreaterThanOrEqual(3);
    const beyond = await route.run(
      request(`${route.path}?page=100000&pageSize=1`),
    );
    expect((await beyond.json()).data).toEqual([]);
    for (const suffix of [
      "limit=1",
      "pageSize=1&limit=1",
      "pageSize=0",
      "pageSize=201",
    ]) {
      expect(
        (await route.run(request(`${route.path}?${suffix}`))).status,
        `${route.path}?${suffix}`,
      ).toBe(400);
    }
  }
});

it("admin.suspended-admin-write-gate", async () => {
  const suspension = await db.userSuspension.create({
    data: { userId: adminId, reason: "Governance suspended" },
  });
  try {
    for (const route of lists.filter(
      (route) => route.path !== "/api/admin/comments",
    )) {
      expect(
        (await route.run(request(`${route.path}?page=1&pageSize=1`))).status,
        route.path,
      ).toBe(200);
    }
    expect(
      (await getAdminSuspensionsRoute(request("/api/admin/suspensions")))
        .status,
    ).toBe(200);
    const pageRequest = request("/admin/users");
    expect(
      await getAdminUsersPage(pageRequest, new URL(pageRequest.url)),
    ).toHaveProperty("users");
    const responses = [
      await getAdminCommentsRoute(request("/api/admin/comments")),
      await patchAdminUserRoute(
        request(`/api/admin/users/${userId}`, "PATCH", {
          name: "must not persist",
        }),
        { id: userId },
      ),
      await patchAdminCommentRoute(
        request(`/api/admin/comments/${commentIds[0]}`, "PATCH", {
          status: "deleted",
        }),
        { id: commentIds[0] },
      ),
      await postAdminSuspensionRoute(
        request("/api/admin/suspensions", "POST", { userId }),
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
      moderateCommentAction({
        locals: { locale: "en-us", requestId: marker },
        request: new Request(`${origin}/admin/moderation`, {
          method: "POST",
          headers: { cookie, origin },
          body: form,
        }),
      }),
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
  const active = await patchAdminUserRoute(
    request(`/api/admin/users/${userId}`, "PATCH", { name: "restored" }),
    { id: userId },
  );
  expect(active.status).toBe(200);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: userId } })).name,
  ).toBe("restored");
});

it("admin.single-open-suspension", async () => {
  const responses = await Promise.all(
    ["first", "second"].map((reason) =>
      postAdminSuspensionRoute(
        request("/api/admin/suspensions", "POST", {
          userId: secondUserId,
          reason,
        }),
      ),
    ),
  );
  for (const response of responses)
    expect(response.status, await response.clone().text()).toBe(201);
  const history = await db.userSuspension.findMany({
    where: { userId: secondUserId },
    orderBy: { createdAt: "asc" },
  });
  expect(history).toHaveLength(2);
  expect(history.filter((row) => row.liftedAt === null)).toHaveLength(1);
  expect(history.filter((row) => row.liftedAt !== null)[0].liftedById).toBe(
    adminId,
  );
  const open = history.find((row) => row.liftedAt === null)!;
  expect((await findActiveSuspension(secondUserId))?.id).toBe(open.id);
  const lifted = await patchAdminSuspensionRoute(
    request(`/api/admin/suspensions/${open.id}`, "PATCH"),
    { id: open.id },
  );
  expect(lifted.status).toBe(200);
  expect(await findActiveSuspension(secondUserId)).toBeNull();
  expect(
    await db.userSuspension.count({ where: { userId: secondUserId } }),
  ).toBe(2);
  expect(
    await db.userSuspension.count({
      where: { userId: secondUserId, liftedAt: null },
    }),
  ).toBe(0);
});

it("admin.admin-mutation-not-found", async () => {
  const id = `missing-${marker}`;
  const responses = [
    await patchAdminUserRoute(
      request(`/api/admin/users/${id}`, "PATCH", { name: "missing" }),
      { id },
    ),
    await postAdminSuspensionRoute(
      request("/api/admin/suspensions", "POST", { userId: id }),
    ),
    await patchAdminCommentRoute(
      request(`/api/admin/comments/${id}`, "PATCH", { status: "deleted" }),
      { id },
    ),
  ];
  for (const response of responses) expect(response.status).toBe(404);
  expect(
    await db.auditLog.count({ where: { userId: adminId, targetId: id } }),
  ).toBe(0);
});

it("admin.admin-self-protection", async () => {
  const responses = [
    await patchAdminUserRoute(
      request(`/api/admin/users/${adminId}`, "PATCH", { isAdmin: false }),
      { id: adminId },
    ),
    await postAdminSuspensionRoute(
      request("/api/admin/suspensions", "POST", { userId: adminId }),
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
  const rollback = new Error("Rollback isolated admin population");
  await expect(
    db.$transaction(
      async (tx) => {
        // Only this transaction observes the temporary population. The app role
        // performs the actual serializable role-change guard's count.
        await tx.user.updateMany({
          where: { isAdmin: true },
          data: { isAdmin: false },
        });
        await tx.user.update({
          where: { id: adminId },
          data: { isAdmin: true },
        });
        await tx.$executeRawUnsafe("SET LOCAL ROLE life_ustc_runtime");
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
        throw rollback;
      },
      { isolationLevel: "Serializable" },
    ),
  ).rejects.toBe(rollback);
  expect(
    await db.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
  ).toEqual(existing);
});
