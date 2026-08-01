import type { Page } from "@playwright/test";
import { absoluteTestUrl } from "../utils/request-url";

export const VISUAL_MATRIX_LOCALES = ["zh-cn", "en-us"] as const;
export type VisualMatrixLocale = (typeof VISUAL_MATRIX_LOCALES)[number];

export const VISUAL_MATRIX_THEME = "light" as const;

export function isVisualRegressionEnabled() {
  return process.env.VISUAL_REGRESSION === "1";
}

export async function applyVisualMatrixContext(
  page: Page,
  options: {
    baseURL: string | undefined;
    locale: VisualMatrixLocale;
    theme?: typeof VISUAL_MATRIX_THEME;
  },
) {
  const theme = options.theme ?? VISUAL_MATRIX_THEME;

  await page.emulateMedia({ colorScheme: "light" });
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: options.locale,
      url: absoluteTestUrl("/", options.baseURL),
      sameSite: "Lax",
    },
  ]);
  await page.addInitScript((themeMode) => {
    localStorage.setItem("life-ustc-theme", themeMode);
  }, theme);
}

export async function syncAuthenticatedLocale(
  page: Page,
  locale: VisualMatrixLocale,
) {
  const sessionResponse = await page.request.get("/api/auth/get-session");
  if (sessionResponse.status() !== 200) {
    return;
  }

  const session = (await sessionResponse.json()) as {
    user?: { id?: string };
  };
  if (!session.user?.id) {
    return;
  }

  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  if (response.status() !== 200) {
    throw new Error(`Failed to sync locale ${locale}: ${response.status()}`);
  }
}
