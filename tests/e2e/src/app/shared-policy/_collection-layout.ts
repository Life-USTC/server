import { expect, type Locator } from "@playwright/test";

export async function expectCollectionOrder(
  first: Locator,
  second: Locator,
  label: string,
) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const handle = await second.elementHandle();
  if (!handle) throw new Error("Missing ordered element");
  expect
    .soft(
      await first.evaluate(
        (node, following) =>
          Boolean(
            node.compareDocumentPosition(following) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        handle,
      ),
      label,
    )
    .toBe(true);
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  if (!a || !b) throw new Error("Missing ordered bounds");
  const followsOnSameRow = Math.abs(a.y - b.y) <= 1 && a.x + a.width <= b.x + 1;
  expect.soft(followsOnSameRow || a.y + a.height <= b.y + 1, label).toBe(true);
}
