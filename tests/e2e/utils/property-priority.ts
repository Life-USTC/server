import { expect, type Locator } from "@playwright/test";

export type VisiblePriorityField = {
  locator: Locator;
  expected: string | RegExp;
  /** Form fields expose their current value instead of text content. */
  input?: boolean;
  /** Image and icon fields are checked through their rendered semantic attribute. */
  attribute?: "src" | "alt" | "aria-label" | "title";
};
export type LocaleHiddenPriorityField = {
  absentInLocale: "zh-cn" | "en-us";
  text: string;
};
export type PriorityField = VisiblePriorityField | LocaleHiddenPriorityField;
export type InternalPriorityField = {
  value: string;
  locator?: Locator;
  exactText?: boolean;
};
export type PriorityViewCheck = {
  /** The real title, card title, or first identifying table cell. */
  identity: Locator;
  scope: Locator;
  primary: Record<string, PriorityField>;
  secondary: Record<string, PriorityField>;
  tertiary: Record<string, InternalPriorityField>;
};
async function textStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      size: Number.parseFloat(style.fontSize),
      weight: Number.parseInt(style.fontWeight, 10),
      color: style.color,
    };
  });
}
async function assertVisibleField(
  field: VisiblePriorityField,
  options: { timeout?: number },
) {
  await field.locator.scrollIntoViewIfNeeded(options);
  await expect(field.locator).toBeVisible(options);
  await expect
    .poll(
      () =>
        field.locator.evaluate((element) =>
          element.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true,
          }),
        ),
      {
        timeout: options.timeout,
        message:
          "expected field must be visibly painted, including its ancestors",
      },
    )
    .toBe(true);
  await expect(field.locator).toBeInViewport();
  if (field.attribute)
    await expect(field.locator).toHaveAttribute(
      field.attribute,
      field.expected,
    );
  else if (field.input) await expect(field.locator).toHaveValue(field.expected);
  else await expect(field.locator).toContainText(field.expected);
}
async function assertSecondaryStyle(locator: Locator, identity: Locator) {
  const [secondary, primary] = await Promise.all([
    textStyle(locator),
    textStyle(identity),
  ]);
  expect(secondary.size).toBeLessThanOrEqual(primary.size);
  expect(secondary.weight).toBeLessThanOrEqual(primary.weight);
  expect(
    secondary.size < primary.size ||
      secondary.weight < primary.weight ||
      secondary.color !== primary.color,
    "secondary metadata must be visually subordinate to the identifying title",
  ).toBe(true);
}

/** Raw small enums may be substrings of legitimate dates; reject standalone visible values. */
export async function assertNoStandaloneInternalText(
  scope: Locator,
  value: string,
) {
  expect(
    await scope.getByText(value, { exact: true }).evaluateAll(
      (elements) =>
        elements.filter((element) =>
          element.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true,
          }),
        ).length,
    ),
  ).toBe(0);
}

export async function assertInternalPriorityFieldAbsent(
  scope: Locator,
  field: InternalPriorityField,
) {
  if (field.exactText) await assertNoStandaloneInternalText(scope, field.value);
  else expect(await scope.innerText()).not.toContain(field.value);
  const values = await scope.evaluate((root) => {
    const elements = [
      root,
      ...root.querySelectorAll("input, textarea, select"),
    ];
    return elements.flatMap((element) => {
      if (
        !element.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        })
      )
        return [];
      if (element instanceof HTMLInputElement)
        return ["hidden", "password", "checkbox", "radio", "file"].includes(
          element.type,
        )
          ? []
          : [element.value];
      if (element instanceof HTMLTextAreaElement) return [element.value];
      if (element instanceof HTMLSelectElement)
        return [...element.selectedOptions].map((option) => option.text);
      return [];
    });
  });
  for (const value of values) {
    if (field.exactText) expect(value.trim()).not.toBe(field.value);
    else expect(value).not.toContain(field.value);
  }
}

/** Explicit, manually maintained field expectations are checked against the rendered page. */
export async function assertPriorityView(
  check: PriorityViewCheck,
  options: { timeout?: number } = {},
) {
  await expect(check.identity).toBeVisible(options);
  async function visible(field: PriorityField) {
    if ("absentInLocale" in field) {
      const language = await check.scope
        .page()
        .locator("html")
        .getAttribute("lang");
      expect(language?.toLowerCase().split("-")[0]).toBe(
        field.absentInLocale.split("-")[0],
      );
      expect(await check.scope.innerText()).not.toContain(field.text);
      return false;
    }
    await assertVisibleField(field, options);
    return true;
  }
  for (const field of Object.values(check.primary)) await visible(field);
  for (const field of Object.values(check.secondary)) {
    if (await visible(field)) {
      if (!("absentInLocale" in field) && !field.attribute)
        await assertSecondaryStyle(field.locator, check.identity);
    }
  }
  for (const field of Object.values(check.tertiary)) {
    if (field.locator) {
      await assertVisibleField(
        {
          locator: field.locator,
          expected: field.value,
        },
        options,
      );
      await assertSecondaryStyle(field.locator, check.identity);
    } else {
      await assertInternalPriorityFieldAbsent(check.scope, field);
    }
  }
}
