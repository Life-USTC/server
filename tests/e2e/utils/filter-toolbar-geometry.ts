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
  await expect(search).toHaveCSS(
    "border-top-left-radius",
    width < 768 ? "12px" : "10px",
  );
  await expect(search).toHaveCSS(
    "border-top-width",
    width < 768 ? "4px" : "2px",
  );
  await expect(search.locator("input")).toHaveCSS(
    "border-top-left-radius",
    "0px",
  );
  await expect(actions).toHaveCount(2);
  for (const button of await actions.all()) {
    await expect(button).toHaveCSS("height", height);
    const inset = width < 768 ? "4px" : "2px";
    await expect(button).toHaveCSS("border-top-width", inset);
    await expect(button).toHaveCSS("border-bottom-width", inset);
    // The background starts at the padding edge, inside the transparent hit area.
    await expect(button).toHaveCSS(
      "border-top-left-radius",
      width < 768 ? "12px" : "10px",
    );
    await button.scrollIntoViewIfNeeded();
    const receivesEdgeClick = await button.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(box.x + box.width / 2, box.y + 1),
      );
    });
    expect(receivesEdgeClick).toBe(true);
  }
  const boxes = await Promise.all(
    (await actions.all()).map((button) => button.boundingBox()),
  );
  expect(boxes[0]?.y).toEqual(boxes[1]?.y);
}

export async function expectTaskCreateButton(button: Locator, width: number) {
  await expect(button).toHaveAccessibleName(/.+/);
  if (width >= 768) {
    await expect(button).toHaveCSS("border-top-left-radius", "10px");
    return;
  }
  await expect(button).toHaveCSS("width", "44px");
  await expect(button).toHaveCSS("height", "44px");
  await expect(button).toHaveCSS("padding-left", "0px");
  await expect(button).toHaveCSS("padding-right", "0px");
  await expect(button).toHaveCSS("border-top-width", "6px");
  const radius = await button.evaluate((element) =>
    parseFloat(getComputedStyle(element).borderTopLeftRadius),
  );
  expect(radius).toBeGreaterThanOrEqual(22);
}
