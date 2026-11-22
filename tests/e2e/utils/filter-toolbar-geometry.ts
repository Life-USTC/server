import { expect, type Locator } from "@playwright/test";

/** Search fields and their neighboring actions share one responsive control height. */
export async function expectFilterToolbarGeometry(
  toolbar: Locator,
  width: number,
) {
  const height = width < 768 ? "44px" : "32px";
  const search = toolbar.locator('[data-slot="input-group"]');
  const actions = toolbar.locator('[data-slot="filter-actions"] button');
  await expect(search).toHaveCSS("height", height);
  await expect(actions).toHaveCount(2);
  for (const button of await actions.all()) {
    await expect(button).toHaveCSS("height", height);
  }
  const boxes = await Promise.all(
    (await actions.all()).map((button) => button.boundingBox()),
  );
  expect(boxes[0]?.y).toEqual(boxes[1]?.y);
}
