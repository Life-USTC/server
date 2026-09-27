import { expect, type Page, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function setup(page: Page) {
  const marker = `homework-audit-${crypto.randomUUID()}`;
  const scope = restWriteScope("community.section-homework");
  const client = await createOAuthClientFixture({
    name: marker,
    scopes: [scope],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Private homework author",
        username: `hwa${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
        email: `${marker}@example.test`,
      },
    }),
  );
  const cookie = await createSignedSessionCookie(user.id);
  await page.context().addCookies([cookie]);
  const token = await authorizeDeviceBearer(
    page.request,
    client.clientId,
    scope,
  );
  const grant = await withE2ePrisma((db) =>
    db.oAuthConsent.findUniqueOrThrow({
      where: {
        clientId_userId: { clientId: client.clientId, userId: user.id },
      },
    }),
  );
  const section = await withE2ePrisma((db) =>
    db.section.findUniqueOrThrow({ where: { jwId: DEV_SEED.section.jwId } }),
  );
  const title = `${marker} private title`;
  const content = `${marker} private description`;
  const headers = {
    authorization: `Bearer ${token}`,
    cookie: "",
    origin: PLAYWRIGHT_BASE_URL,
  };
  const input = {
    sectionJwId: section.jwId,
    title,
    description: content,
    isMajor: true,
    requiresTeam: true,
  };
  const ids: string[] = [];
  return {
    user,
    client,
    grant,
    section,
    token,
    cookie,
    title,
    content,
    headers,
    input,
    ids,
    async cleanup() {
      await withE2ePrisma(async (db) => {
        await db.homework.deleteMany({
          where: {
            OR: [{ id: { in: ids } }, { title: { startsWith: marker } }],
          },
        });
        await db.auditLog.deleteMany({ where: { userId: user.id } });
      });
      await deleteOAuthClientsByName(marker);
      await withE2ePrisma((db) => db.user.delete({ where: { id: user.id } }));
    },
  };
}

type Fixture = Awaited<ReturnType<typeof setup>>;
async function audit(
  f: Fixture,
  id: string,
  action: "homework_create" | "homework_update" | "homework_delete",
  changedFields?: string[],
) {
  const rows = await withE2ePrisma((db) =>
    db.auditLog.findMany({
      where: { userId: f.user.id, targetId: id, action },
    }),
  );
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

async function rejectAudit(f: Fixture) {
  const constraint = `homework_audit_${crypto.randomUUID().replaceAll("-", "")}`;
  await withE2ePrisma((db) =>
    db.$executeRawUnsafe(
      `ALTER TABLE public."AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" IS DISTINCT FROM '${f.user.id.replaceAll("'", "''")}' OR "action" NOT IN ('homework_create', 'homework_update', 'homework_delete')) NOT VALID`,
    ),
  );
  return () =>
    withE2ePrisma((db) =>
      db.$executeRawUnsafe(
        `ALTER TABLE public."AuditLog" DROP CONSTRAINT "${constraint}"`,
      ),
    );
}

test("audit.action-homework-create", async ({ page }) => {
  const f = await setup(page);
  let restore: (() => Promise<number>) | undefined;
  try {
    restore = await rejectAudit(f);
    expect(
      (
        await page.request.post("/api/community/section-homeworks", {
          data: f.input,
          headers: f.headers,
        })
      ).status(),
    ).toBe(500);
    expect(
      await withE2ePrisma((db) =>
        db.homework.count({ where: { title: f.title } }),
      ),
    ).toBe(0);
    await restore();
    restore = undefined;
    const response = await page.request.post(
      "/api/community/section-homeworks",
      { data: f.input, headers: f.headers },
    );
    expect(response.status()).toBe(201);
    const body = await response.json();
    f.ids.push(body.id);
    expect(
      await withE2ePrisma((db) =>
        db.homework.findUniqueOrThrow({
          where: { id: body.id },
          include: { description: { include: { edits: true } } },
        }),
      ),
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
  } finally {
    if (restore) await restore();
    await f.cleanup();
  }
});

test("audit.action-homework-update", async ({ page }) => {
  const f = await setup(page);
  let restore: (() => Promise<number>) | undefined;
  try {
    const creator = await withE2ePrisma((db) =>
      db.user.findUniqueOrThrow({
        where: { username: DEV_SEED.debugUsername },
      }),
    );
    const homework = await withE2ePrisma((db) =>
      db.homework.create({
        data: {
          sectionId: f.section.id,
          title: f.title,
          createdById: creator.id,
        },
      }),
    );
    f.ids.push(homework.id);
    restore = await rejectAudit(f);
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
      await withE2ePrisma((db) =>
        db.homework.findUniqueOrThrow({
          where: { id: homework.id },
          include: { description: true },
        }),
      ),
    ).toMatchObject({ title: f.title, description: null });
    await restore();
    restore = undefined;
    expect(
      (
        await page.request.patch(
          `/api/community/section-homeworks/${homework.id}`,
          { data, headers: f.headers },
        )
      ).status(),
    ).toBe(200);
    expect(
      await withE2ePrisma((db) =>
        db.homework.findUniqueOrThrow({
          where: { id: homework.id },
          include: { description: true },
        }),
      ),
    ).toMatchObject({
      title: data.title,
      createdById: creator.id,
      updatedById: f.user.id,
      description: { content: f.content },
    });
    await audit(f, homework.id, "homework_update", ["description", "title"]);
  } finally {
    if (restore) await restore();
    await f.cleanup();
  }
});

test("audit.action-homework-delete", async ({ page }) => {
  const f = await setup(page);
  let restore: (() => Promise<number>) | undefined;
  try {
    const homework = await withE2ePrisma((db) =>
      db.homework.create({
        data: {
          sectionId: f.section.id,
          title: f.title,
          createdById: f.user.id,
        },
      }),
    );
    f.ids.push(homework.id);
    restore = await rejectAudit(f);
    expect(
      (
        await page.request.delete(
          `/api/community/section-homeworks/${homework.id}`,
          { headers: f.headers },
        )
      ).status(),
    ).toBe(500);
    expect(
      (
        await withE2ePrisma((db) =>
          db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
        )
      ).deletedAt,
    ).toBeNull();
    await restore();
    restore = undefined;
    expect(
      (
        await page.request.delete(
          `/api/community/section-homeworks/${homework.id}`,
          { headers: f.headers },
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await withE2ePrisma((db) =>
          db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
        )
      ).deletedAt,
    ).toBeInstanceOf(Date);
    const row = await audit(f, homework.id, "homework_delete");
    expect(row.metadata).toEqual({ sectionId: f.section.id });
  } finally {
    if (restore) await restore();
    await f.cleanup();
  }
});
