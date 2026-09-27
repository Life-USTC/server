import { expect, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function createProfile() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  return withE2ePrisma(async (db) => {
    const user = await db.user.create({
      data: {
        name: `Heatmap ${suffix}`,
        username: `heatmap${suffix}`,
        email: `heatmap-${suffix}@example.test`,
      },
    });
    const section = await db.section.findFirstOrThrow({
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const now = new Date();
    await db.comment.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        userId: user.id,
        sectionId: section.id,
        body: `Heatmap contribution ${suffix}/${index}`,
        visibility: "public",
        status: "active",
        isAnonymous: false,
        createdAt: now,
      })),
    });
    return {
      ...user,
      contributionDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now),
    };
  });
}

async function deleteProfile(id: string) {
  await withE2ePrisma(async (db) => {
    await db.comment.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });
  });
}

test("ui.contribution-heatmap-1", async ({ page }) => {
  const user = await createProfile();
  try {
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, `/community/users/${user.username}`);
      const scroll = page.locator("[data-profile-heatmap-scroll]");
      await expect(scroll).toBeVisible();
      const result = await scroll.evaluate((region) => {
        const cells = Array.from(
          region.querySelectorAll<HTMLElement>(
            "[data-profile-contribution-cell]",
          ),
        );
        const inaccessible: string[] = [];
        for (const cell of cells) {
          cell.scrollIntoView({ block: "nearest", inline: "nearest" });
          const bounds = region.getBoundingClientRect();
          const box = cell.getBoundingClientRect();
          if (box.left < bounds.left - 1 || box.right > bounds.right + 1)
            inaccessible.push(cell.dataset.date ?? "missing");
        }
        return {
          dates: cells.map((cell) => cell.dataset.date),
          inaccessible,
          scrollWidth: region.scrollWidth,
          clientWidth: region.clientWidth,
          overflow: getComputedStyle(region).overflowX,
          documentWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          scrollLeft: region.scrollLeft,
        };
      });
      expect(result.dates.length).toBeGreaterThanOrEqual(365);
      expect(new Set(result.dates).size).toBe(result.dates.length);
      expect(result.inaccessible).toEqual([]);
      expect(result.overflow).toBe("auto");
      expect(result.documentWidth).toBeLessThanOrEqual(result.viewport);
      if (width < 640) {
        expect(result.scrollWidth).toBeGreaterThan(result.clientWidth);
        expect(result.scrollLeft).toBeGreaterThan(0);
      }
    }
  } finally {
    await deleteProfile(user.id);
  }
});

test("ui.contribution-heatmap-2", async ({ browser, baseURL }) => {
  const user = await createProfile();
  try {
    for (const locale of ["zh-cn", "en-us"]) {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      });
      try {
        await context.addCookies([
          { name: "NEXT_LOCALE", value: locale, url: baseURL! },
        ]);
        const page = await context.newPage();
        await gotoAndWaitForReady(page, `/community/users/${user.username}`);
        const grid = page.getByRole("grid");
        await expect(grid).toHaveAccessibleName(
          locale === "zh-cn" ? /贡献记录/ : /Contribution history/,
        );
        const cells = grid.getByRole("gridcell");
        const actual = await cells.evaluateAll((elements) =>
          elements.map((element) => ({
            date: element.getAttribute("data-date")!,
            count: Number(element.getAttribute("data-count")),
            label: element.getAttribute("aria-label"),
          })),
        );
        expect(actual.length).toBeGreaterThanOrEqual(365);
        const formatter = new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Shanghai",
          dateStyle: "medium",
        });
        for (const cell of actual) {
          const count = cell.date === user.contributionDate ? 3 : 0;
          expect(cell.count).toBe(count);
          const date = formatter.format(new Date(cell.date));
          expect(cell.label).toBe(
            locale === "zh-cn"
              ? `${date}：${count} 条记录`
              : `${count} activities on ${date}`,
          );
        }
        expect(actual.some((cell) => cell.count === 3)).toBe(true);
        await expect(grid.locator('[tabindex="0"]')).toHaveCount(1);
        await cells.first().focus();
        const columns = Number(await grid.getAttribute("aria-colcount"));
        const detail = page.locator("[data-profile-contribution-detail]");
        await expect(detail).toHaveAttribute("aria-live", "polite");
        for (const [key, index] of [
          ["ArrowRight", 1],
          ["ArrowDown", columns + 1],
          ["Home", columns],
          ["End", columns * 2 - 1],
          ["Control+End", actual.length - 1],
          ["Control+Home", 0],
        ] as const) {
          await page.keyboard.press(key);
          await expect(cells.nth(index)).toBeFocused();
          await expect(detail).toHaveText(actual[index].label!);
          await expect(cells.nth(index)).toHaveAttribute(
            "aria-selected",
            "true",
          );
          await expect(grid.locator('[tabindex="0"]')).toHaveCount(1);
        }
        for (const index of [
          0,
          actual.findIndex((cell) => cell.count === 3),
          actual.length - 1,
        ]) {
          await cells.nth(index).tap();
          await expect(detail).toHaveText(actual[index].label!);
          await expect(cells.nth(index)).toHaveAttribute(
            "aria-selected",
            "true",
          );
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await deleteProfile(user.id);
  }
});
