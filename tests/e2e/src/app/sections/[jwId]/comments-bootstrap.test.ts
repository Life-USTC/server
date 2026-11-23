import { expect } from "@playwright/test";
import {
  arrangeSectionDetails,
  test,
} from "../../../../utils/catalog-detail-fixture";
import { DEV_SEED } from "../../../../utils/dev-seed";

test("loads section comments once across delayed shell bootstrap", {
  tag: "@Section/Web",
}, async ({ page, preferenceFlow, detailCatalog, isolatedWorker }) => {
  await preferenceFlow.prepare(() =>
    isolatedWorker.database.owner.$transaction((db) =>
      arrangeSectionDetails(db, detailCatalog),
    ),
  );
  await preferenceFlow.run(async () => {
    let comments = 0;
    let shellReturned = false;
    const early: string[] = [];
    await page.route("**/_internal/shell-bootstrap*", async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      shellReturned = true;
      await route.fulfill({ response });
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/community/comments") {
        comments++;
        if (!shellReturned) early.push(request.url());
      }
    });
    const loaded = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/community/comments" && r.ok(),
    );
    await page.goto(`/catalog/sections/${DEV_SEED.section.jwId}/introduction`);
    await loaded;
    expect(shellReturned).toBe(true);
    expect(early).toEqual([]);
    expect(comments).toBe(1);
  });
});
