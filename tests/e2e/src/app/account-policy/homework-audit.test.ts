import { expect } from "@playwright/test";
import { type HomeworkAudit, test } from "./homework-audit-fixture";

async function audit(
  f: HomeworkAudit,
  id: string,
  action: "homework_create" | "homework_update" | "homework_delete",
  changedFields?: string[],
) {
  const rows = await f.db.auditLog.findMany({
    where: { userId: f.user.id, targetId: id, action },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    userId: f.user.id,
    subjectUserId: f.user.id,
    targetId: id,
    targetType: "homework",
    outcome: "success",
    channel: "rest",
    oauthClientId: f.client.clientId,
    oauthGrantId: f.grant.grantId,
    metadata: {
      sectionId: f.section.id,
      ...(changedFields ? { changedFields } : {}),
    },
  });
  for (const secret of [
    f.token,
    f.cookie.value,
    f.title,
    f.content,
    f.user.email,
    f.user.name,
  ])
    expect(JSON.stringify(rows)).not.toContain(secret);
  return rows[0];
}

async function rejectAudit(f: HomeworkAudit) {
  const constraint = `homework_audit_${crypto.randomUUID().replaceAll("-", "")}`;
  await f.db.$executeRawUnsafe(
    `ALTER TABLE public."AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" IS DISTINCT FROM '${f.user.id.replaceAll("'", "''")}' OR "action" NOT IN ('homework_create', 'homework_update', 'homework_delete')) NOT VALID`,
  );
  return () =>
    f.db.$executeRawUnsafe(
      `ALTER TABLE public."AuditLog" DROP CONSTRAINT "${constraint}"`,
    );
}

test("audit.action-homework-create", async ({ page, homeworkRun }) => {
  await homeworkRun("create", async (f) => {
    const restore = await rejectAudit(f);
    expect(
      (
        await page.request.post("/api/community/section-homeworks", {
          data: f.input,
          headers: f.headers,
        })
      ).status(),
    ).toBe(500);
    expect(await f.db.homework.count({ where: { title: f.title } })).toBe(0);
    await restore();

    const response = await page.request.post(
      "/api/community/section-homeworks",
      {
        data: f.input,
        headers: f.headers,
      },
    );
    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(
      await f.db.homework.findUniqueOrThrow({
        where: { id: body.id },
        include: { description: { include: { edits: true } } },
      }),
    ).toMatchObject({
      title: f.title,
      createdById: f.user.id,
      description: {
        content: f.content,
        edits: [expect.objectContaining({ nextContent: f.content })],
      },
    });
    await audit(f, body.id, "homework_create", [
      "title",
      "isMajor",
      "requiresTeam",
      "publishedAt",
      "submissionStartAt",
      "submissionDueAt",
      "description",
    ]);
  });
});

test("audit.action-homework-update", async ({ page, homeworkRun }) => {
  await homeworkRun("update", async (f) => {
    const creator = await f.db.user.create({
      data: {
        username: "private-homework-creator",
        name: "Another private homework author",
        email: "private-homework-creator@example.test",
      },
    });
    const homework = await f.db.homework.create({
      data: {
        sectionId: f.section.id,
        title: f.title,
        createdById: creator.id,
      },
    });

    const restore = await rejectAudit(f);
    const data = { title: `${f.title} edited`, description: f.content };
    expect(
      (
        await page.request.patch(
          `/api/community/section-homeworks/${homework.id}`,
          { data, headers: f.headers },
        )
      ).status(),
    ).toBe(500);
    expect(
      await f.db.homework.findUniqueOrThrow({
        where: { id: homework.id },
        include: { description: true },
      }),
    ).toMatchObject({ title: f.title, description: null });
    await restore();

    expect(
      (
        await page.request.patch(
          `/api/community/section-homeworks/${homework.id}`,
          { data, headers: f.headers },
        )
      ).status(),
    ).toBe(200);
    expect(
      await f.db.homework.findUniqueOrThrow({
        where: { id: homework.id },
        include: { description: true },
      }),
    ).toMatchObject({
      title: data.title,
      createdById: creator.id,
      updatedById: f.user.id,
      description: { content: f.content },
    });
    await audit(f, homework.id, "homework_update", ["description", "title"]);
  });
});

test("audit.action-homework-delete", async ({ page, homeworkRun }) => {
  await homeworkRun("delete", async (f) => {
    const homework = await f.db.homework.create({
      data: {
        sectionId: f.section.id,
        title: f.title,
        createdById: f.user.id,
      },
    });

    const restore = await rejectAudit(f);
    expect(
      (
        await page.request.delete(
          `/api/community/section-homeworks/${homework.id}`,
          { headers: f.headers },
        )
      ).status(),
    ).toBe(500);
    expect(
      (await f.db.homework.findUniqueOrThrow({ where: { id: homework.id } }))
        .deletedAt,
    ).toBeNull();
    await restore();

    expect(
      (
        await page.request.delete(
          `/api/community/section-homeworks/${homework.id}`,
          { headers: f.headers },
        )
      ).status(),
    ).toBe(200);
    expect(
      (await f.db.homework.findUniqueOrThrow({ where: { id: homework.id } }))
        .deletedAt,
    ).toBeInstanceOf(Date);
    const row = await audit(f, homework.id, "homework_delete");
    expect(row.metadata).toEqual({ sectionId: f.section.id });
  });
});
