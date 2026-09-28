import { expect, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("user.public-identity-display", async ({ page }, testInfo) => {
  const marker = `identity-${crypto.randomUUID().slice(0, 8)}`;
  const fixture = await withE2ePrisma(async (db) => {
    const course = await db.course.create({
      data: {
        jwId: 1_800_000_000 + Math.floor(Math.random() * 100_000_000),
        code: marker,
        nameCn: marker,
      },
    });
    const entries = [];
    for (const [index, name, username] of [
      [0, "Public Display Name", `${marker}-named`],
      [1, "", `${marker}-username`],
      [2, "   ", null],
    ] as const) {
      const user = await db.user.create({
        data: { name, username, email: `${marker}-${index}@example.test` },
      });
      const comments = [];
      for (const isAnonymous of [false, true])
        comments.push(
          await db.comment.create({
            data: {
              courseId: course.id,
              userId: user.id,
              body: `${marker}-${index}-${isAnonymous}`,
              isAnonymous,
            },
          }),
        );
      entries.push({ user, comments });
    }
    return { course, entries };
  });
  try {
    for (const locale of ["en-us", "zh-cn"] as const) {
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: locale,
          url: testInfo.project.use.baseURL as string,
        },
      ]);
      for (const { user } of fixture.entries) {
        const expected =
          user.name.trim() ||
          user.username ||
          (locale === "en-us" ? "User" : "用户");
        await gotoAndWaitForReady(page, `/community/users/${user.id}`);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          expected,
        );
        await expect(page).toHaveTitle(`${expected} - Life@USTC`);
        expect(await page.locator("#main-content").innerText()).not.toContain(
          user.id,
        );
      }
      await gotoAndWaitForReady(
        page,
        `/catalog/courses/${fixture.course.jwId}`,
      );
      for (const { user, comments } of fixture.entries) {
        const anonymousLabel = locale === "en-us" ? "Anonymous" : "匿名";
        for (const comment of comments) {
          const expected = comment.isAnonymous
            ? anonymousLabel
            : user.name.trim() || user.username || anonymousLabel;
          const article = page.locator(`#comment-${comment.id}`);
          await expect(article.getByRole("heading", { level: 3 })).toHaveText(
            expected,
          );
          expect(await article.innerText()).not.toContain(user.id);
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`public-identity-${locale}.png`),
        fullPage: true,
      });
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.course.delete({ where: { id: fixture.course.id } });
      await db.user.deleteMany({
        where: { id: { in: fixture.entries.map(({ user }) => user.id) } },
      });
    });
  }
});
