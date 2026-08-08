import { redirect, type ServerLoadEvent } from "@sveltejs/kit";
import { providerNames } from "@/features/auth/server/signin-page-copy";
import { getCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { getSessionFromHeaders } from "@/lib/auth/core";
import { prisma } from "@/lib/db/prisma";
import { resolveWelcomeCallbackUrl } from "./welcome-callback-url";
import { completeWelcomeProfile } from "./welcome-complete-action";
import { refreshWelcomeOAuthProfile } from "./welcome-oauth-refresh-action";
import { getWelcomeCopy } from "./welcome-page-copy";

const REFRESHABLE_PROVIDERS = new Set(["github", "google", "oidc"]);

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

  if (user.name && user.username) {
    throw redirect(303, callbackUrl);
  }

  return {
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
    copy: getWelcomeCopy(locals.locale),
  };
};

export const welcomeActions = {
  complete: completeWelcomeProfile,
  refreshOAuth: refreshWelcomeOAuthProfile,
};
