import { expect, type Page, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

const ROOM_CODE = "3A204";
const MAP_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23f4f4f5'/%3E%3Crect x='220' y='100' width='200' height='160' fill='%23dbeafe' stroke='%230369a1' stroke-width='8'/%3E%3Ctext x='320' y='190' text-anchor='middle' font-size='28' fill='%230f172a'%3E3A204%3C/text%3E%3C/svg%3E";

async function mockRoomMap(page: Page) {
  await page.route("**/api/catalog/rooms/**/map", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        building: "第三教学楼",
        code: ROOM_CODE,
        floor: "1",
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

  test("焦点预览加载标注地图，点击后打开可缩放对话框", async ({ page }) => {
    await mockRoomMap(page);
    await gotoAndWaitForReady(
      page,
      `/catalog/rooms?room=${encodeURIComponent(ROOM_CODE)}`,
    );

    const trigger = page.getByRole("button", {
      name: new RegExp(ROOM_CODE),
    });
    await expect(trigger).toBeVisible();
    await trigger.focus();

    const preview = page.getByTestId("room-map-preview-popover");
    await expect(preview).toBeVisible();
    await expect(
      preview.getByRole("img", { name: new RegExp(ROOM_CODE) }),
    ).toBeVisible();

    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("img", { name: new RegExp(ROOM_CODE) }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Zoom in|放大/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("移动端点击房间后打开地图", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockRoomMap(page);
    await gotoAndWaitForReady(
      page,
      `/catalog/rooms?room=${encodeURIComponent(ROOM_CODE)}`,
    );

    const trigger = page.getByRole("button", {
      name: new RegExp(ROOM_CODE),
    });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await trigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      44,
    );
  });
});
