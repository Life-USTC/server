import { expect, test } from "@playwright/test";
import { assertNoStandaloneInternalText } from "../../../utils/property-priority";

test("raw numeric absence distinguishes date substrings and nested visible enum values", async ({
  page,
}) => {
  await page.setContent(
    "<main><time>2026-09-27</time><span>星期日 Sunday</span><span hidden>7</span></main>",
  );
  const scope = page.locator("main");
  await assertNoStandaloneInternalText(scope, "7");
  await scope.evaluate((element) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = "<strong><span>7</span></strong>";
    element.append(wrapper);
  });
  await expect(assertNoStandaloneInternalText(scope, "7")).rejects.toThrow();
});
