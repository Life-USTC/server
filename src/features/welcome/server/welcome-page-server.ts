import { redirect, type ServerLoadEvent } from "@sveltejs/kit";
import { providerNames } from "@/features/auth/server/signin-page-copy";
import { getCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import {
  buildWelcomeStepUrl,
  nextWelcomeStep,
  parseWelcomeStep,
  previousWelcomeStep,
  WELCOME_STEPS,
  type WelcomeStep,
  welcomeStepNumber,
} from "@/features/welcome/lib/welcome-steps";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { getSessionFromHeaders } from "@/lib/auth/core";
import { prisma } from "@/lib/db/prisma";
import { resolveWelcomeCallbackUrl } from "./welcome-callback-url";
import { completeWelcomeProfile } from "./welcome-complete-action";
import { refreshWelcomeOAuthProfile } from "./welcome-oauth-refresh-action";
import { getWelcomeCopy } from "./welcome-page-copy";

const REFRESHABLE_PROVIDERS = new Set(["github", "google", "oidc"]);

const STEP_TITLE_KEYS = {
  profile: "stepProfile",
  subscriptions: "stepSubscriptions",
  finish: "stepFinish",
} as const satisfies Record<WelcomeStep, string>;

function buildStepIndicators(
  step: WelcomeStep,
  copy: ReturnType<typeof getWelcomeCopy>,
) {
  const currentNumber = welcomeStepNumber(step);
  return WELCOME_STEPS.map((id) => ({
    id,
    label: copy.welcome[STEP_TITLE_KEYS[id]],
    number: welcomeStepNumber(id),
    state:
      id === step
        ? ("current" as const)
        : welcomeStepNumber(id) < currentNumber
          ? ("complete" as const)
          : ("upcoming" as const),
  }));
}

export const loadWelcomePage = async ({
  locals,
  request,
  url,
}: ServerLoadEvent) => {
  const callbackUrl = resolveWelcomeCallbackUrl(
    url.searchParams.get("callbackUrl"),
  );
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(
        `${url.pathname}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ),
    );
  }

  const [user, semesters, currentSemester] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        profilePictures: true,
        accounts: {
          select: { provider: true },
        },
      },
    }),
    prisma.semester.findMany({
      select: { id: true, nameCn: true },
      orderBy: { jwId: "desc" },
      take: 20,
    }),
    getCurrentSemester(new Date()),
  ]);

  if (!user) {
    throw redirect(
      303,
      buildSignInPageUrl(
        `${url.pathname}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ),
    );
  }

  // Profile is the only required step, so an incomplete profile always returns
  // there and a complete profile never lands back on it.
  const hasCompleteProfile = Boolean(user.name && user.username);
  const step = hasCompleteProfile
    ? parseWelcomeStep(url.searchParams.get("step"))
    : "profile";
  if (hasCompleteProfile && step === "profile") {
    throw redirect(303, callbackUrl);
  }

  const copy = getWelcomeCopy(locals.locale);
  const previousStep = previousWelcomeStep(step);
  const followingStep = nextWelcomeStep(step);

  return {
    step,
    stepIndicators: buildStepIndicators(step, copy),
    backUrl: previousStep
      ? buildWelcomeStepUrl(previousStep, callbackUrl)
      : null,
    nextUrl: followingStep
      ? buildWelcomeStepUrl(followingStep, callbackUrl)
      : callbackUrl,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      profilePictures: user.profilePictures,
    },
    oauthProviders: Array.from(
      new Set(
        user.accounts
          .map(({ provider }) => provider)
          .filter((provider) => REFRESHABLE_PROVIDERS.has(provider)),
      ),
    ).map((id) => ({
      id,
      name:
        providerNames(locals.locale)[
          id as keyof ReturnType<typeof providerNames>
        ] ?? id,
    })),
    oauthRefreshed: url.searchParams.get("oauthRefreshed") === "1",
    semesters,
    defaultSemesterId: currentSemester?.id ?? null,
    callbackUrl,
    locale: locals.locale,
    copy,
  };
};

export const welcomeActions = {
  complete: completeWelcomeProfile,
  refreshOAuth: refreshWelcomeOAuthProfile,
};
