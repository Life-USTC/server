import type { loadWelcomePage } from "../server/welcome-page-server";

export type WelcomePageData = Awaited<ReturnType<typeof loadWelcomePage>>;
export type WelcomeCopy = WelcomePageData["copy"]["welcome"];
export type WelcomeStepIndicator = WelcomePageData["stepIndicators"][number];
