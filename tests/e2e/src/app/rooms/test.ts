import { expect, type Page, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";
import { SECTION_URL } from "../sections/[jwId]/_helpers";

const ROOM_CODE = "3A204";
const MAP_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23f4f4f5'/%3E%3Crect x='220' y='100' width='200' height='160' fill='%23dbeafe' stroke='%230369a1' stroke-width='8'/%3E%3Ctext x='320' y='190' text-anchor='middle' font-size='28' fill='%230f172a'%3E3A204%3C/text%3E%3C/svg%3E";

async function mockRoomMap(page: Page) {
  await page.route("**/api/catalog/rooms/**/map", async (route) => {
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
}

test.describe("/catalog/rooms 教室地图", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/catalog/rooms", testInfo });
  });

  test("查询展示地图，点击后打开可缩放对话框", async ({ page }) => {
    await mockRoomMap(page);
    await gotoAndWaitForReady(page, `/catalog/rooms?room=${ROOM_CODE}`);
    const result = page.getByTestId("room-map-preview");
    await expect(result.getByRole("img")).toBeVisible();
    await result.getByRole("button", { name: /Open map|放大地图/ }).click();
    const dialog = page.getByTestId("room-map-dialog");
    await expect(dialog).toBeVisible();
    const scroll = dialog.getByTestId("room-map-scroll");
    await dialog
      .getByRole("button", { name: /Zoom in|放大/, exact: true })
      .click();
    await expect
      .poll(() => scroll.evaluate((el) => el.scrollWidth > el.clientWidth))
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("班级教室支持悬停和键盘焦点预览", async ({ page }) => {
    await mockRoomMap(page);
    await gotoAndWaitForReady(page, `${SECTION_URL}#calendar`);
    const trigger = page
      .locator("#calendar")
      .getByTestId("room-map-preview")
      .getByRole("button")
      .first();
    await trigger.hover();
    const preview = page.getByTestId("room-map-preview-popover");
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("img")).toBeVisible();
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

  test("移动端点击房间后打开地图", async ({ page }) => {
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
