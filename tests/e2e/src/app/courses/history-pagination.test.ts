import { expect, type Page } from "@playwright/test";
import { test } from "../../../utils/catalog-browser-fixture";
import type { CommunityFlow } from "../../../utils/community-flow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { observeAction } from "../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";

// Isolated rows, never shared seed courses or teachers. Equal sort values force
// the unique jwId tie-breaker to keep all 23 offerings reachable without repeats.
async function verifyHistory(
  page: Page,
  kind: "course" | "teacher",
  worker: IsolatedWorker,
  flow: CommunityFlow,
) {
  const fixtureId = kind === "course" ? 1900100001 : 1900100101;
  const sectionBase = kind === "course" ? 1900200000 : 1900200100;
  test.setTimeout(120_000);
  const db = worker.database.owner;
  let verifyState: () => Promise<void> = async () => {
    throw new Error("History fixture was not prepared");
  };
  await flow.run(
    async () => {
      const fixture = await db.$transaction(async (prisma) => {
        const course = await prisma.course.create({
          data: {
            jwId: fixtureId,
            code: "E2E-HISTORY",
            nameCn: "历史分页测试课程",
            nameEn: "Historical offerings",
          },
        });
        const teacher = await prisma.teacher.create({
          data: {
            jwId: fixtureId,
            nameCn: "历史分页测试教师",
            nameEn: "History teacher",
          },
        });
        const sections = [];
        for (let index = 0; index < 23; index++) {
          sections.push(
            await prisma.section.create({
              data: {
                jwId: sectionBase + index,
                code: "E2E-HISTORY.01",
                courseId: course.id,
                retiredAt:
                  index >= 20 ? new Date("2025-01-01T00:00:00Z") : null,
                teachers: { connect: { id: teacher.id } },
              },
              include: { teachers: { select: { id: true } } },
            }),
          );
        }
        return { course, teacher, sections };
      });
      verifyState = async () => {
        // After browser and deferred work settle, every prepared row must be unchanged.
        expect(await db.course.findMany()).toEqual([fixture.course]);
        expect(await db.teacher.findMany()).toEqual([fixture.teacher]);
        expect(
          await db.section.findMany({
            orderBy: { jwId: "asc" },
            include: { teachers: { select: { id: true } } },
          }),
        ).toEqual(fixture.sections);
      };

      const route =
        kind === "course"
          ? `/catalog/courses/${fixture.course.jwId}`
          : `/catalog/teachers/${fixture.teacher.id}`;
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        const response = await gotoAndWaitForReady(page, route);
        const history = page.getByTestId("section-history");
        await expect(history).toContainText(/共 23 条|total: 23/);
        const rows = page.locator(
          '#sections a[href^="/catalog/sections/"]:visible',
        );
        const firstPageIds = new Set(
          await rows.evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          ),
        );
        expect(firstPageIds.size).toBe(20);
        await history
          .getByRole("link", { name: /下一页|Next/i, exact: true })
          .click();
        await expect(page).toHaveURL(
          new RegExp(`${route}\\?sectionsPage=2#sections$`),
        );
        await expect(history).toContainText(/21–23/);
        const secondPageIds = new Set(
          await rows.evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          ),
        );
        expect(secondPageIds.size).toBe(3);
        expect(new Set([...firstPageIds, ...secondPageIds]).size).toBe(23);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          new RegExp(`${route}$`),
        );
        // A direct reload must retain page 2 even after root HTML warmed its cache.
        const pagedResponse = await page.reload();
        expect(pagedResponse?.headers()["cache-control"]).toContain("no-store");
        await expect(history).toContainText(/21–23/);
        await expect(
          page
            .locator(
              `#sections a[href="/catalog/sections/${sectionBase + 22}"]:visible`,
            )
            .first(),
        ).toBeVisible();
        await history
          .getByRole("link", { name: /上一页|Previous/i, exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp(`${route}#sections$`));
        await expect(history).toContainText(/1–20/);
        expect(response?.status()).toBe(200);
      }
      await gotoAndWaitForReady(page, `${route}?sectionsPage=2#sections`);
      const viewerPath = `/_internal/catalog/sections/${sectionBase + 22}/viewer`;
      // Client navigation reads the destination section viewer. Observe that
      // actual read before clicking and require it to complete successfully.
      await observeAction(
        async () => {
          const request = await page.waitForEvent("requestfinished", {
            predicate: (request) =>
              request.method() === "GET" &&
              new URL(request.url()).pathname === viewerPath,
          });
          const response = await request.response();
          if (!response) throw new Error("Finished request has no response");
          expect(response.status()).toBe(200);
          await response.body();
        },
        () =>
          page
            .locator(
              `#sections a[href="/catalog/sections/${sectionBase + 22}"]:visible`,
            )
            .first()
            .click(),
      );
      await expect(page).toHaveURL(
        new RegExp(`/catalog/sections/${sectionBase + 22}$`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByTestId("section-mobile-primary-actions"),
      ).toBeVisible();
      await waitForUiSettled(page);
    },
    { anonymousCourseCount: 1 },
    {
      async verifyTransport({ sdkRequests }) {
        expect(sdkRequests).toEqual([]);
      },
      verifyState: () => verifyState(),
    },
  );
}

test(
  "course.bounded-detail-history",
  { tag: "@Catalog/Web" },
  async ({ page, isolatedWorker, catalogFlow }) =>
    verifyHistory(page, "course", isolatedWorker, catalogFlow),
);
test(
  "teacher.bounded-detail-history",
  { tag: "@Catalog/Web" },
  async ({ page, isolatedWorker, catalogFlow }) =>
    verifyHistory(page, "teacher", isolatedWorker, catalogFlow),
);
