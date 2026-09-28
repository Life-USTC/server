import { expect } from "@playwright/test";
import { test } from "./admin-audit-fixture";

test("audit.action-admin-user-suspend", async ({ page, audit: f }) => {
  const prior = await f.db.userSuspension.create({
    data: {
      userId: f.target.id,
      createdById: f.admin.id,
      reason: "Previous private reason",
    },
  });
  const submit = () =>
    page.request.post("/api/admin/suspensions", {
      data: {
        userId: f.target.id,
        reason: f.reason,
        note: f.note,
        expiresAt: "2030-01-01T00:00:00.000Z",
      },
    });
  await f.rejectAudit("admin_user_suspend");
  expect((await submit()).status()).toBe(500);
  expect(
    await f.db.userSuspension.findMany({ where: { userId: f.target.id } }),
  ).toEqual([prior]);
  expect(await f.events("admin_user_suspend")).toHaveLength(0);
  await f.restoreAudit();
  const response = await submit();
  expect(response.status(), await response.text()).toBe(201);
  const { suspension } = await response.json();
  const rows = await f.db.userSuspension.findMany({
    where: { userId: f.target.id },
  });
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.id === prior.id)).toMatchObject({
    liftedAt: expect.any(Date),
    liftedById: f.admin.id,
  });
  expect(rows.find((row) => row.id === suspension.id)).toMatchObject({
    userId: f.target.id,
    createdById: f.admin.id,
    reason: f.reason,
    note: f.note,
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    liftedAt: null,
  });
  const events = await f.events("admin_user_suspend");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: f.admin.id,
    subjectUserId: f.target.id,
    targetId: f.target.id,
    targetType: "user",
    channel: "rest",
    outcome: "success",
    oauthClientId: null,
    oauthGrantId: null,
    metadata: { reasonProvided: true },
  });
  expect(events[0].metadata).toEqual({ reasonProvided: true });
  f.assertSafe(events);
});

test("audit.action-admin-user-unsuspend", async ({ page, audit: f }) => {
  const prior = await f.db.userSuspension.create({
    data: {
      userId: f.target.id,
      createdById: f.admin.id,
      reason: f.reason,
      note: f.note,
    },
  });
  const submit = () => page.request.patch(`/api/admin/suspensions/${prior.id}`);
  await f.rejectAudit("admin_user_unsuspend");
  expect((await submit()).status()).toBe(500);
  expect(
    await f.db.userSuspension.findUnique({ where: { id: prior.id } }),
  ).toEqual(prior);
  expect(await f.events("admin_user_unsuspend")).toHaveLength(0);
  await f.restoreAudit();
  expect((await submit()).status()).toBe(200);
  expect(
    await f.db.userSuspension.findUnique({ where: { id: prior.id } }),
  ).toMatchObject({
    liftedAt: expect.any(Date),
    liftedById: f.admin.id,
  });
  const events = await f.events("admin_user_unsuspend");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: f.admin.id,
    subjectUserId: f.target.id,
    targetId: f.target.id,
    targetType: "user",
    channel: "rest",
    outcome: "success",
    metadata: { suspensionId: prior.id },
  });
  expect(events[0].metadata).toEqual({ suspensionId: prior.id });
  f.assertSafe(events);
});

test("audit.action-admin-comment-moderate", async ({ page, audit: f }) => {
  const section = await f.db.section.create({
    data: {
      jwId: 1,
      code: "AUDIT.01",
      course: {
        create: { jwId: 1, code: "AUDIT", nameCn: "审计课程" },
      },
      semester: {
        create: { jwId: 1, code: "2026-1", nameCn: "审计学期" },
      },
    },
  });
  const prior = await f.db.comment.create({
    data: {
      userId: f.target.id,
      sectionId: section.id,
      body: f.content,
      visibility: "public",
      status: "active",
    },
  });
  const submit = () =>
    page.request.patch(`/api/admin/comments/${prior.id}`, {
      data: {
        status: "softbanned",
        moderationNote: f.note,
      },
    });
  await f.rejectAudit("admin_comment_moderate");
  expect((await submit()).status()).toBe(500);
  expect(await f.db.comment.findUnique({ where: { id: prior.id } })).toEqual(
    prior,
  );
  expect(await f.events("admin_comment_moderate")).toHaveLength(0);
  await f.restoreAudit();
  expect((await submit()).status()).toBe(200);
  expect(
    await f.db.comment.findUnique({ where: { id: prior.id } }),
  ).toMatchObject({
    body: f.content,
    status: "softbanned",
    moderationNote: f.note,
    moderatedById: f.admin.id,
    moderatedAt: expect.any(Date),
    deletedAt: null,
  });
  const events = await f.events("admin_comment_moderate");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: f.admin.id,
    subjectUserId: f.target.id,
    targetId: prior.id,
    targetType: "comment",
    channel: "rest",
    outcome: "success",
    metadata: { status: "softbanned", moderationNoteProvided: true },
  });
  expect(events[0].metadata).toEqual({
    status: "softbanned",
    moderationNoteProvided: true,
  });
  f.assertSafe(events);
});

test("audit.action-admin-user-role-update", async ({ page, audit: f }) => {
  const submit = () =>
    page.request.patch(`/api/admin/users/${f.target.id}`, {
      data: { isAdmin: true },
    });
  await f.rejectAudit("admin_user_role_update");
  expect((await submit()).status()).toBe(500);
  expect(await f.db.user.findUnique({ where: { id: f.target.id } })).toEqual(
    f.target,
  );
  expect(await f.events("admin_user_role_update")).toHaveLength(0);
  await f.restoreAudit();
  expect((await submit()).status()).toBe(200);
  expect(
    await f.db.user.findUnique({
      where: { id: f.target.id },
      select: { isAdmin: true },
    }),
  ).toEqual({ isAdmin: true });
  const events = await f.events("admin_user_role_update");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: f.admin.id,
    subjectUserId: f.target.id,
    targetId: f.target.id,
    targetType: "user",
    channel: "rest",
    outcome: "success",
  });
  expect(events[0].metadata).toEqual({ changedFields: ["isAdmin"] });
  f.assertSafe(events);
  expect((await submit()).status()).toBe(200);
  expect(await f.events("admin_user_role_update")).toEqual(events);
  expect(await f.events("admin_user_profile_update")).toHaveLength(0);
});

test("audit.action-admin-user-profile-update", async ({ page, audit: f }) => {
  const name = "New private managed name";
  const username = `new${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const submit = () =>
    page.request.patch(`/api/admin/users/${f.target.id}`, {
      data: { name, username },
    });
  await f.rejectAudit("admin_user_profile_update");
  expect((await submit()).status()).toBe(500);
  expect(await f.db.user.findUnique({ where: { id: f.target.id } })).toEqual(
    f.target,
  );
  expect(await f.events("admin_user_profile_update")).toHaveLength(0);
  await f.restoreAudit();
  expect((await submit()).status()).toBe(200);
  expect(
    await f.db.user.findUnique({
      where: { id: f.target.id },
      select: { name: true, username: true, isAdmin: true },
    }),
  ).toEqual({ name, username, isAdmin: false });
  const events = await f.events("admin_user_profile_update");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: f.admin.id,
    subjectUserId: f.target.id,
    targetId: f.target.id,
    targetType: "user",
    channel: "rest",
    outcome: "success",
  });
  expect(events[0].metadata).toEqual({ changedFields: ["name", "username"] });
  f.assertSafe(events);
  for (const secret of [name, username, f.target.username])
    expect(JSON.stringify(events)).not.toContain(secret);
  expect((await submit()).status()).toBe(200);
  expect(await f.events("admin_user_profile_update")).toEqual(events);
  expect(await f.events("admin_user_role_update")).toHaveLength(0);
});

test("audit.action-admin-description-moderate", async ({ page, audit: f }) => {
  const course = await f.db.course.create({
    data: {
      jwId: 1_700_000_000 + Math.floor(Math.random() * 100_000_000),
      code: `AUDIT-${crypto.randomUUID()}`,
      nameCn: "审计课程",
      nameEn: "Audit course",
    },
  });

  const prior = await f.db.description.create({
    data: {
      courseId: course.id,
      content: "Previous private description",
      lastEditedById: f.target.id,
    },
  });
  const submit = () =>
    page.request.patch(`/api/admin/descriptions/${prior.id}`, {
      data: { content: f.content },
    });
  await f.rejectAudit("admin_description_moderate");
  expect((await submit()).status()).toBe(500);
  expect(
    await f.db.description.findUnique({ where: { id: prior.id } }),
  ).toEqual(prior);
  expect(
    await f.db.descriptionEdit.count({ where: { descriptionId: prior.id } }),
  ).toBe(0);
  expect(await f.events("admin_description_moderate")).toHaveLength(0);
  await f.restoreAudit();
  expect((await submit()).status()).toBe(200);
  expect(
    await f.db.description.findUnique({ where: { id: prior.id } }),
  ).toMatchObject({
    content: f.content,
    lastEditedById: f.admin.id,
    lastEditedAt: expect.any(Date),
  });
  const edits = await f.db.descriptionEdit.findMany({
    where: { descriptionId: prior.id },
  });
  expect(edits).toHaveLength(1);
  expect(edits[0]).toMatchObject({
    editorId: f.admin.id,
    previousContent: prior.content,
    nextContent: f.content,
  });
  const events = await f.events("admin_description_moderate");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: f.admin.id,
    targetId: prior.id,
    targetType: "description",
    channel: "rest",
    outcome: "success",
  });
  expect(events[0].metadata).toEqual({ changedFields: ["content"] });
  f.assertSafe(events);
  expect(JSON.stringify(events)).not.toContain(prior.content);
});

test("audit.action-admin-bus-version-delete", async ({ page, audit: f }) => {
  await f.db.busScheduleVersion.create({
    data: {
      key: "active-audit-version",
      checksum: "active-audit-version",
      title: "Current version must survive archived deletion",
      isEnabled: true,
      rawJson: {},
    },
  });
  const activeBefore = await f.db.busScheduleVersion.findMany({
    where: { isEnabled: true },
    orderBy: { id: "asc" },
  });
  const marker = `bus-audit-${crypto.randomUUID()}`;
  const version = await f.db.busScheduleVersion.create({
    data: {
      key: marker,
      checksum: marker,
      title: "Private archived import title",
      isEnabled: false,
      rawJson: { message: f.content },
      sourceMessage: f.note,
      sourceUrl: `https://example.test/${marker}`,
    },
  });

  const route = await f.db.busRoute.create({
    data: { id: 1, nameCn: "独立审计线路" },
  });
  const trip = await f.db.busTrip.create({
    data: {
      versionId: version.id,
      routeId: route.id,
      dayType: "weekday",
      position: 1,
      stopTimes: ["08:00", "08:30"],
    },
  });
  const submit = () =>
    page.request.post("/admin/bus?/deleteVersion", {
      form: { id: String(version.id) },
      headers: { "x-sveltekit-action": "true", accept: "application/json" },
    });
  await f.rejectAudit("admin_bus_version_delete");
  expect((await submit()).status()).toBe(500);
  expect(
    await f.db.busScheduleVersion.findUnique({ where: { id: version.id } }),
  ).toEqual(version);
  expect(await f.db.busTrip.findUnique({ where: { id: trip.id } })).toEqual(
    trip,
  );
  expect(await f.events("admin_bus_version_delete")).toHaveLength(0);
  await f.restoreAudit();
  const response = await submit();
  expect(response.status(), await response.text()).toBe(200);
  expect(await response.json()).toMatchObject({ type: "success" });
  expect(
    await f.db.busScheduleVersion.findUnique({ where: { id: version.id } }),
  ).toBeNull();
  expect(await f.db.busTrip.findUnique({ where: { id: trip.id } })).toBeNull();
  const events = await f.events("admin_bus_version_delete");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: f.admin.id,
    targetId: String(version.id),
    targetType: "bus_schedule_version",
    channel: "web",
    outcome: "success",
    metadata: null,
  });
  f.assertSafe(events);
  for (const secret of [version.key, version.title, version.sourceUrl])
    expect(JSON.stringify(events)).not.toContain(secret);
  const repeat = await submit();
  expect(await repeat.json()).toMatchObject({ type: "failure", status: 404 });
  expect(await f.events("admin_bus_version_delete")).toEqual(events);
  expect(
    await f.db.busScheduleVersion.findMany({
      where: { isEnabled: true },
      orderBy: { id: "asc" },
    }),
  ).toEqual(activeBefore);
});
