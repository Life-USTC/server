import { expect } from "@playwright/test";
import { test } from "../../../utils/public-worker";

test("anonymous workspace canonical routing", { tag: "@Site/Web" }, async ({
  publicFlow,
  page,
}) => {
  await publicFlow.run(async () => {
    await test.step("仪表盘 › 未登录旧 homework tab 永久重定向到受保护语义路径", async () => {
      const response = await page.request.get(
        "/?tab=homeworks&homeworkView=list",
        {
          maxRedirects: 0,
        },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/workspace/homeworks?homeworkView=list",
      );
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("仪表盘 › /workspace 默认永久重定向到 overview 语义路径", async () => {
      for (const method of ["GET", "HEAD"]) {
        const response = await page.request.fetch(
          "/workspace?overviewWeek=next",
          {
            maxRedirects: 0,
            method,
          },
        );

        expect(response.status()).toBe(308);
        expect(response.headers().location).toBe(
          "/workspace/overview?overviewWeek=next",
        );
      }
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("仪表盘作业 › 未登录旧 homework tab 重定向到语义路径", async () => {
      const response = await page.request.get(
        "/?tab=homeworks&homeworkView=list",
        {
          maxRedirects: 0,
        },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/workspace/homeworks?homeworkView=list",
      );
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("仪表盘作业 › 未登录语义路径要求登录", async () => {
      const response = await page.request.get("/workspace/homeworks", {
        maxRedirects: 0,
      });

      expect(response.status()).toBe(303);
      expect(response.headers().location).toBe(
        "/account/sign-in?callbackUrl=%2Fworkspace%2Fhomeworks",
      );
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("仪表盘考试 › 未登录旧 exams tab 重定向到语义路径", async () => {
      const response = await page.request.get("/?tab=exams&examView=list", {
        maxRedirects: 0,
      });

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/workspace/exams?examView=list",
      );
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("仪表盘日历 › 未登录旧 calendar tab 重定向到语义路径", async () => {
      const response = await page.request.get(
        "/?tab=calendar&calendarView=week",
        {
          maxRedirects: 0,
        },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/workspace/calendar?calendarView=week",
      );
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("仪表盘日历 › workspace 查询 tab 也仅作为永久兼容入口", async () => {
      const response = await page.request.get(
        "/workspace?tab=calendar&calendarView=week",
        {
          maxRedirects: 0,
        },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/workspace/calendar?calendarView=week",
      );
      await publicFlow.assertAnonymousNoEffects();
    });
  }, {});
});
