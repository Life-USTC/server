import { expect } from "@playwright/test";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test as catalogTest } from "../../../utils/catalog-browser-fixture";
import { test as ownedTest } from "../../../utils/owned-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

const rooms = [
  { code: "3A204", building: "三教主", floor: "2" },
  { code: "3A205", building: "三教主", floor: "2" },
  { code: "5201", building: "五教", floor: "2" },
].map((room) => ({
  ...room,
  imagePath: `imgs/rooms/${room.code}.png`,
  sourceImagePath: "imgs/floor.png",
}));
const test = catalogTest.extend({
  workerOutboundJson: {
    url: "https://static.life-ustc.tiankaima.dev/room_maps.json",
    json: { rooms },
  },
});

test(
  "room-map.url-navigation",
  { tag: "@RoomMap/Web" },
  async ({ page, isolatedWorker, catalogFlow }, info) => {
    const db = isolatedWorker.database.owner;
    await catalogFlow.run(async () => {
      const campus = await db.campus.create({
        data: {
          jwId: 1,
          code: "west",
          nameCn: "西校区",
          nameEn: "West campus",
        },
      });
      const building = await db.building.create({
        data: {
          jwId: 1,
          code: "third",
          nameCn: "第三教学楼",
          campusId: campus.id,
        },
      });
      await db.room.createMany({
        data: ["3A204", "3A205"].map((code, i) => ({
          jwId: i + 1,
          code,
          nameCn: code,
          buildingId: building.id,
          virtual: false,
          seats: 80,
          seatsForSection: 80,
        })),
      });
      await page.route("**/api/catalog/rooms/**/map", async (route) => {
        const code = decodeURIComponent(
          new URL(route.request().url()).pathname.split("/").at(-2) ?? "",
        );
        await route.fulfill({
          json: {
            code: code === "3a204" ? "3A204" : code,
            building: "三教主",
            floor: "2",
            status: "highlighted",
            imageUrl:
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect width='640' height='360' fill='%23eeeeee'/%3E%3Ctext x='200' y='180' font-size='32'%3E3A204%3C/text%3E%3C/svg%3E",
            sourceImageUrl: null,
          },
        });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await gotoAndWaitForReady(page, "/catalog/rooms");
      await info.attach("rooms-directory-desktop", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await page
        .getByTestId("room-map-sample-chip")
        .filter({ hasText: "3A204" })
        .click();
      await expect(
        page.getByTestId("room-map-preview").getByRole("img"),
      ).toBeVisible();
      await info.attach("rooms-selected-desktop", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await expect(page).toHaveURL(/\?room=3A204$/);
      await page.reload();
      await expect(
        page.getByTestId("room-map-preview").getByRole("img"),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /教室编号|Room code/ }),
      ).toHaveValue("3A204");
      const directory = page.getByTestId("room-map-building-index");
      await expect(
        directory.getByRole("button", { name: /West campus|西校区/ }),
      ).toHaveAttribute("aria-expanded", "true");
      await expect(
        directory.getByRole("button", { name: /三教主/ }),
      ).toHaveAttribute("aria-expanded", "true");
      await directory.scrollIntoViewIfNeeded();
      await info.attach("rooms-expanded-directory", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await directory.getByRole("link", { name: "3A205", exact: true }).click();
      await expect(page).toHaveURL(/\?room=3A205$/);
      await page.goBack();
      await expect(page).toHaveURL(/\?room=3A204$/);
      await expect(
        page.getByRole("textbox", { name: /教室编号|Room code/ }),
      ).toHaveValue("3A204");
      await page.goForward();
      await expect(page).toHaveURL(/\?room=3A205$/);
      await expect(
        page.getByRole("textbox", { name: /教室编号|Room code/ }),
      ).toHaveValue("3A205");
      await page
        .getByRole("textbox", { name: /教室编号|Room code/ })
        .fill("3a204");
      await page.getByRole("button", { name: /^(查询|Look up)$/ }).click();
      await expect(page).toHaveURL(/\?room=3a204$/);
      await expect(
        page.getByRole("textbox", { name: /教室编号|Room code/ }),
      ).toHaveValue("3a204");
      await page.setViewportSize({ width: 390, height: 844 });
      await info.attach("rooms-selected-mobile", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await gotoAndWaitForReady(page, "/catalog/rooms");
      await expect(
        directory.getByRole("link", { name: "3A204", exact: true }),
      ).toHaveCount(0);
      await info.attach("rooms-directory-mobile", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await directory
        .getByRole("button", { name: /Campus not recorded|未记录校区/ })
        .click();
      await directory.getByRole("button", { name: /五教/ }).click();
      await directory.getByRole("button", { name: /2/ }).click();
      await expect(
        directory.getByRole("link", { name: "5201", exact: true }),
      ).toBeVisible();
      expect(await db.room.count()).toBe(2);
    });
  },
);

test("room-map.optional-campus-failure", { tag: "@RoomMap/Web" }, async ({
  page,
  isolatedWorker,
  catalogFlow,
}) => {
  await catalogFlow.run(async () => {
    // Revoke only this owned DB's optional Room read to reproduce an unavailable
    // catalog association while keeping the static manifest and map path usable.
    await isolatedWorker.database.owner.$executeRawUnsafe(
      'REVOKE SELECT ON "Room" FROM life_ustc_runtime',
    );
    try {
      await gotoAndWaitForReady(page, "/catalog/rooms");
      await expect(page.getByTestId("room-map-building-index")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Campus not recorded|未记录校区/ }),
      ).toBeVisible();
      await page.route("**/api/catalog/rooms/**/map", async (route) =>
        route.fulfill({
          json: {
            code: "3A204",
            building: "三教主",
            floor: "2",
            status: "highlighted",
            imageUrl:
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40'/%3E%3C/svg%3E",
            sourceImageUrl: null,
          },
        }),
      );
      await page
        .getByTestId("room-map-sample-chip")
        .filter({ hasText: "3A204" })
        .click();
      await expect(page).toHaveURL(/\?room=3A204$/);
      await expect(
        page.getByTestId("room-map-preview").getByRole("img"),
      ).toBeVisible();
    } finally {
      await isolatedWorker.database.owner.$executeRawUnsafe(
        'GRANT SELECT ON "Room" TO life_ustc_runtime',
      );
    }
  });
});

const normalizationTest = ownedTest.extend({
  workerOutboundJson: [
    {
      url: "https://static.life-ustc.tiankaima.dev/room_maps.json",
      json: { rooms },
    },
    {
      url: "https://static.life-ustc.tiankaima.dev/building_img_rules.json",
      json: [],
    },
  ],
});
normalizationTest(
  "room-map.raw-code-normalization",
  { tag: "@RoomMap/Web" },
  async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.context().addCookies([
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            // Only the static image bytes are owned here; map responses use the real Worker/service.
            await page.route(
              "https://static.life-ustc.tiankaima.dev/imgs/rooms/3A204.png",
              (route) =>
                route.fulfill({
                  contentType: "image/svg+xml",
                  body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><text x="20" y="40">Owned room 3A204</text></svg>',
                }),
            );
            await gotoAndWaitForReady(page, "/catalog/rooms");
            const field = page.getByRole("textbox", {
              name: "Room code",
              exact: true,
            });
            const preview = page.getByTestId("room-map-preview");
            for (const [raw, canonical, status] of [
              ["Ⅷ".repeat(17), "VIII".repeat(17), "unavailable"],
              ["ﬄ".repeat(22), "FFL".repeat(22), "unavailable"],
              ["３ａ２０４", "3A204", "highlighted"],
            ] as const) {
              await field.fill(raw);
              const [response] = await Promise.all([
                page.waitForResponse(
                  (response) =>
                    new URL(response.url()).pathname ===
                      `/api/catalog/rooms/${encodeURIComponent(raw)}/map` &&
                    response.request().method() === "GET",
                ),
                page
                  .getByRole("button", { name: "Look up", exact: true })
                  .click(),
              ]);
              expect(response.status()).toBe(200);
              expect(await response.json()).toMatchObject({
                code: canonical,
                status,
              });
              expect(new URL(page.url()).searchParams.get("room")).toBe(raw);
              await expect(field).toHaveValue(raw);
              if (status === "unavailable") {
                await expect(preview).toContainText(
                  "A map is not available for this room yet.",
                );
                await expect(preview.getByRole("img")).toHaveCount(0);
              } else {
                await expect(preview).toContainText("Room highlighted");
                await expect(preview.getByRole("img")).toHaveAttribute(
                  "src",
                  "https://static.life-ustc.tiankaima.dev/imgs/rooms/3A204.png",
                );
              }
            }
            // Direct raw HTTP negatives exercise the same schema; the input's maxlength is not a server guard.
            for (const raw of ["A".repeat(65), "invalid_code"]) {
              const response = await page.request.get(
                `/api/catalog/rooms/${encodeURIComponent(raw)}/map`,
              );
              expect(response.status()).toBe(400);
              await response.body();
            }
          }),
        ),
      ),
    );
  },
);
