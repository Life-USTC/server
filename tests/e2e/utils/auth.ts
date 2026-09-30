import { expect, type Page } from "@playwright/test";
import { gotoAndWaitForReady } from "./page-ready";

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function expectPagePath(page: Page, path: string) {
  const pattern = path === "/" ? "\\/$" : escapeForRegExp(path);
  await expect(page).toHaveURL(new RegExp(`${pattern}$`));
}

type SignInProvider = "ustc" | "github" | "google";

const SIGN_IN_PROVIDER_LABELS: Record<SignInProvider, RegExp> = {
  ustc: /USTC/i,
  github: /GitHub/i,
  google: /Google/i,
};

export async function expectRequiresSignIn(
  page: Page,
  path: string,
  options: {
    providers?: SignInProvider[];
  } = {},
) {
  await gotoAndWaitForReady(page, path, {
    expectMainContent: false,
  });

  await expect(page).toHaveURL(/\/account\/sign-in(?:\?.*)?$/);
  for (const provider of options.providers ?? ["ustc"]) {
    await expect(
      page.getByRole("button", { name: SIGN_IN_PROVIDER_LABELS[provider] }),
    ).toBeVisible();
  }
}
