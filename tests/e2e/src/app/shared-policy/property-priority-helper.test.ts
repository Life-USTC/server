import { expect, test } from "@playwright/test";
import {
  assertInternalPriorityFieldAbsent,
  assertNoStandaloneInternalText,
  assertPriorityView,
  type PriorityViewCheck,
} from "../../../utils/property-priority";

test("raw numeric absence distinguishes date substrings and nested visible enum values", {
  tag: "@Infrastructure/Web",
}, async ({ page }) => {
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

test("priority fields reject transparent and hidden elements through their ancestors", {
  tag: "@Infrastructure/Web",
}, async ({ page }) => {
  const html =
    '<main><h1 id="title" style="font-size:20px;font-weight:600">Public task</h1><div><span id="due">Tomorrow 12:30</span></div><span id="completed">Pending</span><div><span id="priority" style="font-size:14px;font-weight:400">High</span></div><div><span id="raw-id" style="font-size:14px;font-weight:400">internal-id-42</span></div></main>';
  function check(): PriorityViewCheck {
    return {
      scope: page.locator("main"),
      identity: page.locator("#title"),
      primary: {
        "todo.title": {
          locator: page.locator("#title"),
          expected: "Public task",
        },
        "todo.dueAt": {
          locator: page.locator("#due"),
          expected: "Tomorrow 12:30",
        },
        "todo.completed": {
          locator: page.locator("#completed"),
          expected: "Pending",
        },
      },
      secondary: {
        "todo.priority": {
          locator: page.locator("#priority"),
          expected: "High",
        },
      },
      tertiary: {
        "todo.id": {
          value: "internal-id-42",
          locator: page.locator("#raw-id"),
        },
        "todo.userId": { value: "absent-user" },
        "todo.createdAt": { value: "absent-created" },
        "todo.updatedAt": { value: "absent-updated" },
      },
    };
  }
  await page.setContent(html);
  await assertPriorityView(check());
  for (const selector of ["#due", "#priority", "#raw-id"]) {
    for (const style of ["opacity:0", "visibility:hidden"]) {
      for (const ancestor of [false, true]) {
        await test.step(`${selector} ${ancestor ? "ancestor" : "self"} ${style}`, async () => {
          await page.setContent(html);
          await page.locator(selector).evaluate(
            (element, input) => {
              (input.ancestor ? element.parentElement : element)?.setAttribute(
                "style",
                input.style,
              );
            },
            { ancestor, style },
          );
          // setContent has settled: fail fast for this intentional defect, while
          // real-page assertions retain their normal readiness timeout.
          await expect(
            assertPriorityView(check(), { timeout: 100 }),
          ).rejects.toThrow();
        });
      }
    }
  }
});

test("internal-field absence checks displayed form values without exposing hidden controls", {
  tag: "@Infrastructure/Web",
}, async ({ page }) => {
  for (const field of [
    { value: "internal-id-42" },
    { value: "7", exactText: true },
  ]) {
    await page.setContent(
      `<main><time>2026-09-27</time><input type="hidden" value="${field.value}"><input style="visibility:hidden" value="${field.value}"><div style="opacity:0"><textarea>${field.value}</textarea></div><select><option value="${field.value}">Public label</option></select></main>`,
    );
    await assertInternalPriorityFieldAbsent(page.locator("main"), field);
    for (const tag of ["input", "textarea"]) {
      const element = page.locator("main");
      await element.evaluate(
        (root, { tag, value }) => {
          const input = document.createElement(tag);
          input.setAttribute("readonly", "");
          if (
            input instanceof HTMLInputElement ||
            input instanceof HTMLTextAreaElement
          )
            input.value = value;
          input.id = "visible-internal";
          root.append(input);
        },
        { tag, value: field.value },
      );
      await expect(
        assertInternalPriorityFieldAbsent(element, field),
      ).rejects.toThrow();
      await page
        .locator("#visible-internal")
        .evaluate((input) => input.remove());
    }
  }
});
