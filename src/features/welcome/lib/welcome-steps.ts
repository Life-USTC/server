export const WELCOME_STEPS = ["profile", "subscriptions", "finish"] as const;

export type WelcomeStep = (typeof WELCOME_STEPS)[number];

export function parseWelcomeStep(value: unknown): WelcomeStep {
  return WELCOME_STEPS.includes(value as WelcomeStep)
    ? (value as WelcomeStep)
    : "profile";
}

export function welcomeStepNumber(step: WelcomeStep) {
  return WELCOME_STEPS.indexOf(step) + 1;
}

export function nextWelcomeStep(step: WelcomeStep): WelcomeStep | null {
  return WELCOME_STEPS[welcomeStepNumber(step)] ?? null;
}

export function previousWelcomeStep(step: WelcomeStep): WelcomeStep | null {
  return WELCOME_STEPS[welcomeStepNumber(step) - 2] ?? null;
}

export function buildWelcomeStepUrl(step: WelcomeStep, callbackUrl: string) {
  return `/account/welcome?step=${step}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
