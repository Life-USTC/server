import { expect, type Page } from "@playwright/test";
import { test as catalogTest } from "../../../utils/catalog-search-fixture";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

const SECTION_URL = `/catalog/sections/${DEV_SEED.section.jwId}`;
const ROOM_CODE = "3A204";
const MAP_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23f4f4f5'/%3E%3Crect x='220' y='100' width='200' height='160' fill='%23dbeafe' stroke='%230369a1' stroke-width='8'/%3E%3Ctext x='320' y='190' text-anchor='middle' font-size='28' fill='%230f172a'%3E3A204%3C/text%3E%3C/svg%3E";

const test = catalogTest.extend<{ roomSchedule: undefined }>({
  roomSchedule: async (
    { searchSection, isolatedWorker, preferenceFlow },
    use,
  ) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction(async (db) => {
        const room = await db.room.create({
          data: {
            jwId: 1,
            nameCn: ROOM_CODE,
            code: ROOM_CODE,
            virtual: false,
            seats: 80,
            seatsForSection: 80,
          },
        });
        const group = await db.scheduleGroup.create({
          data: {
            jwId: 1,
            sectionId: searchSection.section.id,
            no: 1,
            limitCount: 80,
            stdCount: 58,
            actualPeriods: 2,
            isDefault: true,
          },
        });
        await db.schedule.create({
          data: {
            sectionId: searchSection.section.id,
            scheduleGroupId: group.id,
            date: new Date("2026-04-29T00:00:00Z"),
            weekday: 3,
            startTime: 840,
            endTime: 1030,
            startUnit: 2,
            endUnit: 3,
            periods: 2,
            weekIndex: 2,
            roomId: room.id,
          },
        });
      }),
    );
    await use(undefined);
  },
});

async function mockRoomMap(page: Page) {
  const requests: string[] = [];
  await page.route("**/api/catalog/rooms/**/map", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      json: {
        building: "第三教学楼",
        code: decodeURIComponent(
          new URL(route.request().url()).pathname.split("/").at(-2) ??
            ROOM_CODE,
        ),
        floor: "2",
        imageUrl: MAP_IMAGE,
        sourceImageUrl: null,
        status: "highlighted",
      },
    });
  });
  return requests;
}

test.describe("/catalog/rooms 教室地图", () => {
  test("页面契约", async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, { routePath: "/catalog/rooms" });
    });
  });

  test("room-map.expanded-map-view", async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await mockRoomMap(page);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, `/catalog/rooms?room=${ROOM_CODE}`);
        const result = page.getByTestId("room-map-preview");
        await expect(result.getByRole("img")).toBeVisible();
        await result.getByRole("button", { name: /Open map|放大地图/ }).click();
        const dialog = page.getByTestId("room-map-dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByRole("link", { name: /Open map|放大地图/ }),
        ).toHaveAttribute("href", MAP_IMAGE);
        const scroll = dialog.getByTestId("room-map-scroll");
        await dialog
          .getByRole("button", { name: /Zoom in|放大/, exact: true })
          .click();
        await expect
          .poll(() => scroll.evaluate((el) => el.scrollWidth > el.clientWidth))
          .toBe(true);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
    });
  });

  test("room-map.web", async ({
    page,
    preferenceFlow,
    roomSchedule: _roomSchedule,
  }) => {
    await preferenceFlow.run(async () => {
      const requests = await mockRoomMap(page);
      await gotoAndWaitForReady(page, `${SECTION_URL}#calendar`);
      const trigger = page
        .locator("#calendar")
        .getByTestId("room-map-preview")
        .getByRole("button")
        .first();
      expect(requests).toHaveLength(0);
      await trigger.hover();
      const preview = page.getByTestId("room-map-preview-popover");
      await expect(preview).toBeVisible();
      await expect(preview.getByRole("img")).toBeVisible();
      expect(requests).toHaveLength(1);
      await page.mouse.move(0, 0);
      await expect(preview).toBeHidden();
      await trigger.focus();
      await expect(preview).toBeVisible();
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("room-map-dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    });
  });
  test("room-map.keyboard-map-access", async ({
    page,
    preferenceFlow,
    roomSchedule: _roomSchedule,
  }) => {
    await preferenceFlow.run(async () => {
      await mockRoomMap(page);
      await gotoAndWaitForReady(page, `${SECTION_URL}#calendar`);
      const trigger = page
        .locator("#calendar")
        .getByTestId("room-map-preview")
        .getByRole("button")
        .first();
      await trigger.focus();
      await expect(page.getByTestId("room-map-preview-popover")).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("room-map-dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("room-map-dialog")).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  });

  test("移动端点击房间后打开地图", async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await mockRoomMap(page);
      await gotoAndWaitForReady(
        page,
        `/catalog/rooms?room=${encodeURIComponent(ROOM_CODE)}`,
      );

      const trigger = page
        .getByTestId("room-map-preview")
        .getByRole("button", { name: /Open map|放大地图/ });
      await expect(trigger).toBeVisible();
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect((await trigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
        44,
      );
    });
  });
  test("网络失败后再次查询同一教室会重试", async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      let requests = 0;
      await page.route("**/api/catalog/rooms/**/map", async (route) => {
        requests += 1;
        if (requests === 1) {
          await route.fulfill({ status: 503, body: "unavailable" });
          return;
        }
        await route.fulfill({
          json: {
            code: ROOM_CODE,
            building: "三教主",
            floor: "2",
            status: "highlighted",
            imageUrl: MAP_IMAGE,
            sourceImageUrl: null,
          },
        });
      });
      await page.goto(`/catalog/rooms?room=${ROOM_CODE}`);
      const result = page.getByTestId("room-map-preview");
      await expect(result.getByRole("alert")).toBeVisible();
      await page
        .getByRole("form", { name: /Room code|教室编号/ })
        .getByRole("button", { name: /查询|Look up/i, exact: true })
        .click();
      await expect(result.getByRole("img")).toBeVisible();
      expect(requests).toBe(2);
    });
  });
});
