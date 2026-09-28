import { expect } from "@playwright/test";
import { test } from "../../../utils/community-fixture";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";

test("ui.detail-two-column-stream-6", async ({
  audiences: { users, contexts },
  community: { targets },
}) => {
  test.setTimeout(90_000);
  const comments: { id: string; body: string; kind: string }[][] = [];
  for (const target of targets) {
    const rows = [];
    for (const kind of ["public", "logged_in_only", "hidden"]) {
      const body = `catalog-private-projection-${kind}-${crypto.randomUUID()}`;
      const { id } = await withE2ePrisma((db) =>
        db.comment.create({
          data: {
            [`${target.type}Id`]: target.id,
            userId: users[0].id,
            body,
            visibility: kind === "logged_in_only" ? "logged_in_only" : "public",
            status: kind === "hidden" ? "softbanned" : "active",
          },
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
        expect(payload.meta.viewer.userId).toBe(users[actorIndex]?.id ?? null);
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
            await expect(page.getByText(row.body, { exact: true })).toHaveCount(
              0,
            );
          }
        }
      } finally {
        release();
        await page.unrouteAll({ behavior: "wait" });
      }
    }
    await page.close();
  }
});
