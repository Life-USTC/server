import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("ui.detail-two-column-stream-6", async ({ browser }) => {
  test.setTimeout(90_000);
  const users = await withE2ePrisma(async (db) => {
    const result = [];
    for (const role of ["owner", "viewer", "admin"])
      result.push(
        await db.user.create({
          data: {
            name: `Private catalog ${role}`,
            username: `cp${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            email: `${crypto.randomUUID()}@example.test`,
            isAdmin: role === "admin",
          },
        }),
      );
    return result;
  });
  const contexts = [];
  const targets = await withE2ePrisma(async (db) => {
    const teacher = await db.teacher.findUniqueOrThrow({
      where: { jwId: DEV_SEED.teacher.jwId },
      select: { id: true },
    });
    return [
      {
        type: "course",
        path: `/catalog/courses/${DEV_SEED.course.jwId}`,
        input: { courseJwId: DEV_SEED.course.jwId },
      },
      {
        type: "section",
        path: `/catalog/sections/${DEV_SEED.section.jwId}`,
        input: { sectionJwId: DEV_SEED.section.jwId },
      },
      {
        type: "teacher",
        path: `/catalog/teachers/${teacher.id}`,
        input: { teacherId: teacher.id },
      },
    ];
  });
  try {
    for (const user of [...users, null]) {
      const context = await browser.newContext({
        baseURL: PLAYWRIGHT_BASE_URL,
      });
      if (user)
        await context.addCookies([await createSignedSessionCookie(user.id)]);
      contexts.push(context);
    }
    const owner = contexts[0];
    if (!owner) throw new Error("Missing owner browser");
    const comments: { id: string; body: string; kind: string }[][] = [];
    for (const target of targets) {
      const rows = [];
      for (const kind of ["public", "logged_in_only", "hidden"]) {
        const body = `catalog-private-projection-${kind}-${crypto.randomUUID()}`;
        const response = await owner.request.post("/api/community/comments", {
          data: {
            targetType: target.type,
            ...target.input,
            body,
            visibility: kind === "logged_in_only" ? "logged_in_only" : "public",
          },
        });
        expect(response.status()).toBe(201);
        const { id } = await response.json();
        if (kind === "hidden")
          await withE2ePrisma((db) =>
            db.comment.update({
              where: { id },
              data: { status: "softbanned" },
            }),
          );
        rows.push({ id, body, kind });
      }
      comments.push(rows);
    }
    for (const [actorIndex, context] of contexts.entries()) {
      const page = await context.newPage();
      for (const [index, target] of targets.entries()) {
        const rows = comments[index];
        if (!rows) throw new Error("Missing comment fixtures");
        // Read the actual SSR response under each actor; no viewer-sensitive
        // comment data may be embedded in reusable catalog HTML.
        const response = await context.request.get(target.path);
        expect(response.status()).toBe(200);
        const html = await response.text();
        for (const row of rows) {
          expect(html).not.toContain(row.body);
          expect(html).not.toContain(row.id);
        }
        for (const user of users) expect(html).not.toContain(user.id);
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let started!: () => void;
        const intercepted = new Promise<void>((resolve) => {
          started = resolve;
        });
        await page.route("**/api/community/comments?**", async (route) => {
          started();
          await gate;
          await route.continue();
        });
        const loaded = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/community/comments" &&
            r.request().method() === "GET",
        );
        try {
          await page.goto(target.path);
          await intercepted;
          for (const row of rows)
            await expect(page.getByText(row.body, { exact: true })).toHaveCount(
              0,
            );
          release();
          const client = await loaded;
          expect(client.status()).toBe(200);
          expect(client.headers()["cache-control"]).toContain("no-store");
          const payload = await client.json();
          expect(payload.meta.viewer.isAuthenticated).toBe(actorIndex !== 3);
          expect(payload.meta.viewer.userId).toBe(
            users[actorIndex]?.id ?? null,
          );
          // Ordinary catalog comments never enter the dedicated governance context.
          expect(payload.meta.viewer.isAdmin).toBe(false);
          for (const row of rows) {
            const node = payload.data.find(
              (item: { id: string }) => item.id === row.id,
            );
            const visible =
              row.kind === "public" ||
              (row.kind === "logged_in_only" && actorIndex !== 3) ||
              (row.kind === "hidden" && actorIndex === 0);
            if (visible) {
              expect(node).toMatchObject({
                body: row.body,
                canModerate: false,
              });
              if (row.kind === "public")
                expect(node).toMatchObject({
                  canEdit: actorIndex === 0,
                  canDelete: actorIndex === 0,
                });
              await expect(page.locator(`#comment-${row.id}`)).toContainText(
                row.body,
              );
            } else {
              expect(JSON.stringify(node ?? null)).not.toContain(row.body);
              await expect(
                page.getByText(row.body, { exact: true }),
              ).toHaveCount(0);
            }
          }
        } finally {
          release();
          await page.unrouteAll({ behavior: "wait" });
        }
      }
      await page.close();
    }
  } finally {
    for (const context of contexts) await context.close();
    const ids = users.map((user) => user.id);
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }],
        },
      });
      await db.comment.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    });
  }
});
