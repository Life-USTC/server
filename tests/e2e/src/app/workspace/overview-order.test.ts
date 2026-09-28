import { expect, test } from "@playwright/test";
import { readSpecification } from "../../../../../scripts/specifications/yaml";
import { semanticContract } from "../../../../shared/specifications/semantic-contract";
import { signInAsDebugUser } from "../../../utils/auth";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("overview.card-order", async ({ page }, testInfo) => {
  const contract = await semanticContract(testInfo.title, "ordered_items");
  contract.equal("/surface", "web");
  contract.equal("/target", { by: "css", value: "[data-overview-sections]" });
  const spec = await readSpecification<{
    requirements: {
      id: string;
      expectation?: { kind: string; items: string[] };
    }[];
  }>("docs/features/overview.yaml");
  const rule = spec.requirements.find(
    (item) => item.id === "overview.card-order",
  )?.expectation;
  if (rule?.kind !== "ordered_items")
    throw new Error("Missing overview order expectation");
  await signInAsDebugUser(page, "/workspace/overview");
  await expect(page.getByTestId("workspace-overview-focus")).toBeVisible();
  for (const locale of ["zh-cn", "en-us"]) {
    const response = await page.request.post("/api/account/preferences", {
      data: { locale },
    });
    expect(response.status()).toBe(200);
    await gotoAndWaitForReady(page, "/workspace/overview");
    await expect(
      page.getByTestId("workspace-overview-summaries"),
    ).toContainText(
      locale === "zh-cn"
        ? "未来 3 天（不含今天）"
        : "Next 3 days, excluding today:",
    );
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const observed = await page
        .locator("[data-overview-sections] > *")
        .evaluateAll((nodes) =>
          nodes.map(
            (node) =>
              node.getAttribute("data-testid") ??
              node
                .querySelector(":scope > [data-testid]")
                ?.getAttribute("data-testid") ??
              null,
          ),
        );
      contract.equal("/items", observed);
      let previousBottom = 0;
      for (const id of rule.items) {
        const section = page.getByTestId(id);
        await expect(section).toBeVisible();
        const box = await section.boundingBox();
        if (!box) throw new Error(`Missing section bounds: ${id}`);
        expect(box.y).toBeGreaterThanOrEqual(previousBottom);
        previousBottom = box.y + box.height;
      }
      await page.screenshot({
        path: testInfo.outputPath(`overview-order-${locale}-${width}.png`),
        fullPage: true,
      });
    }
  }
  contract.recordPlaywright(testInfo);
});
