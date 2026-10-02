import { expect } from "@playwright/test";
import { withCommunityFlow } from "../../../utils/community-flow";
import { test } from "../../../utils/owned-worker";

test("signed-in catalog documents remain public while the private shell resolves the viewer", async ({
  page,
  browser,
  request: observer,
  isolatedWorker,
  run,
}) => {
  await run(async () => {
    const actor = await isolatedWorker.createActor();
    await withCommunityFlow(
      { page, browser, observer, isolatedWorker, account: actor },
      async (flow) => {
        await flow.run(async () => {
          const db = isolatedWorker.database.owner;
          const viewerName = "Private catalog viewer";
          await db.user.update({
            where: { id: actor.id },
            data: { name: viewerName },
          });
          const course = await db.course.create({
            data: {
              jwId: 1_800_000_000,
              code: "PRIVATE-CATALOG-SHELL",
              nameCn: "独立公开目录课程",
              nameEn: "Private catalog shell course",
            },
          });

          // Context construction installs the flow probe headers on its HTTP
          // client. Complete this anonymous GET before attaching the session.
          const anonymousContext = await flow.newContext();
          const anonymous =
            await anonymousContext.request.get("/catalog/courses");
          expect(anonymous.status()).toBe(200);
          const anonymousHtml = await anonymous.text();
          expect(anonymousHtml).toContain(course.code);
          expect(anonymousHtml).not.toContain(actor.id);
          expect(anonymousHtml).not.toContain(viewerName);
          await anonymous.dispose();
          await flow.closeContext(anonymousContext);
          await page.context().addCookies([actor.cookie]);

          // Join both operations even when navigation or the response wait fails.
          const [shellResult, documentResult] = await Promise.allSettled([
            page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname ===
                "/_internal/shell-bootstrap",
            ),
            page.goto("/catalog/courses"),
          ]);
          if (
            shellResult.status === "rejected" &&
            documentResult.status === "rejected"
          ) {
            throw new AggregateError(
              [shellResult.reason, documentResult.reason],
              "Catalog navigation and private shell response both failed",
            );
          }
          if (shellResult.status === "rejected") throw shellResult.reason;
          if (documentResult.status === "rejected") throw documentResult.reason;
          const document = documentResult.value;
          expect(document?.status()).toBe(200);
          if (!document) throw new Error("Missing document response");
          const html = await document.text();
          expect(html).toContain(course.code);
          expect(html).not.toContain(actor.id);
          expect(html).not.toContain(viewerName);

          const shell = shellResult.value;
          expect(shell.status()).toBe(200);
          expect(shell.headers()["cache-control"]).toBe("private, no-store");
          expect((await shell.json()).viewer.id).toBe(actor.id);
          await expect(page.locator("#app-user-menu")).toContainText(
            viewerName,
          );
        });
      },
    );
  });
});
