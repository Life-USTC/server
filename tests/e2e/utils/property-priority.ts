import { expect, type Locator } from "@playwright/test";
import { readSpecifications } from "../../../scripts/specifications/repository";
import {
  PRESENTATION_VIEW_FAMILIES,
  type PresentationViewFamily,
} from "../../shared/presentation-view-owners";

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
  feature: string;
  capability: string;
  view: string;
  /** The real title, card title, or first identifying table cell. */
  identity: Locator;
  scope: Locator;
  primary: Record<string, PriorityField>;
  secondary: Record<string, PriorityField>;
  tertiary: Record<string, InternalPriorityField>;
};
type Fields = { primary: string[]; secondary: string[]; tertiary: string[] };
const declarations = readSpecifications().then(
  (files) =>
    new Map(
      files.flatMap(({ data }) =>
        Object.entries(
          (data.capabilities ?? {}) as Record<
            string,
            { presentation?: { views?: Record<string, Fields> } }
          >,
        ).flatMap(([capability, { presentation }]) =>
          Object.entries(presentation?.views ?? {})
            .filter(([view]) => view.startsWith("web"))
            .map(
              ([view, fields]) =>
                [`${data.id}/${capability}/${view}`, fields] as const,
            ),
        ),
      ),
    ),
);

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
async function assertVisibleField(field: VisiblePriorityField) {
  await expect(async () => {
    await field.locator.scrollIntoViewIfNeeded();
    await expect(field.locator).toBeVisible();
  }).toPass();
  await field.locator.scrollIntoViewIfNeeded();
  await expect(field.locator).toBeVisible();
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
        message:
          "declared field must be visibly painted, including its ancestors",
      },
    )
    .toBe(true);
  await expect(async () => {
    await field.locator.scrollIntoViewIfNeeded();
    await expect(field.locator).toBeInViewport({ timeout: 500 });
  }).toPass();
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

/** Every declared property is consumed; missing and surplus assertions fail. */
export async function assertPriorityView(check: PriorityViewCheck) {
  const key = `${check.feature}/${check.capability}/${check.view}` as const;
  const fields = (await declarations).get(key);
  expect(fields, key).toBeDefined();
  if (!fields) throw new Error(`Missing presentation view: ${key}`);
  for (const group of ["primary", "secondary", "tertiary"] as const)
    expect(Object.keys(check[group]).sort(), `${key}.${group}`).toEqual(
      [...fields[group]].sort(),
    );
  await expect(check.identity).toBeVisible();
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
    await assertVisibleField(field);
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
      await assertVisibleField({
        locator: field.locator,
        expected: field.value,
      });
      await assertSecondaryStyle(field.locator, check.identity);
    } else {
      await assertInternalPriorityFieldAbsent(check.scope, field);
    }
  }
}

/** A browser owner fails if it omits any view assigned to its family. */
export function createPriorityViewAudit(family: PresentationViewFamily) {
  const owner = PRESENTATION_VIEW_FAMILIES[family];
  const visited = new Set<string>();
  return {
    async check(input: PriorityViewCheck) {
      const key = `${input.feature}/${input.capability}/${input.view}`;
      expect(owner.views as readonly string[], owner.requirement).toContain(
        key,
      );
      await assertPriorityView(input);
      visited.add(key);
    },
    finish() {
      expect([...visited].sort(), owner.requirement).toEqual(
        [...owner.views].sort(),
      );
    },
  };
}
