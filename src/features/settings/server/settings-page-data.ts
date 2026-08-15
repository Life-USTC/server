import { redirect } from "@sveltejs/kit";
import { listUserOAuthAuthorizations } from "@/features/oauth/server/user-authorizations.server";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import type { UserUstcIdentitySummary } from "@/features/settings/lib/ustc-identity";
import { listOwnAccountSecurityActivityPage } from "@/features/settings/server/account-activity";
import { buildSettingsAccountProviders } from "@/features/settings/server/settings-account-providers";
import { listUserUstcIdentities } from "@/features/settings/server/user-ustc-identity-read-model";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";

export type SettingsAccountProvider = {
  id: "oidc" | "github" | "google";
  name: string;
  linked: boolean;
  accountId: string | null;
  providerAccountId: string | null;
  ustcIdentities: UserUstcIdentitySummary | null;
};

export async function requireSettingsUser(request: Request, url: URL) {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    const callback = `${url.pathname}${url.search}`;
    throw redirect(303, buildSignInPageUrl(callback));
  }
  return session.user;
}

export async function getSettingsPageData(
  request: Request,
  url: URL,
  tab: SettingsTab,
) {
  const sessionUser = await requireSettingsUser(request, url);
  const loadUstcIdentities = tab === "accounts";
  const [user, accounts, authorizations, ustcIdentities, securityActivity] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          image: true,
          profilePictures: true,
        },
      }),
      authPrisma.account.findMany({
        where: { userId: sessionUser.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          createdAt: true,
        },
      }),
      tab === "authorizations"
        ? listUserOAuthAuthorizations(sessionUser.id)
        : Promise.resolve([]),
      loadUstcIdentities
        ? listUserUstcIdentities(sessionUser.id)
        : Promise.resolve({ upstreamUids: [], records: [] }),
      tab === "security"
        ? listOwnAccountSecurityActivityPage(sessionUser.id, {
            cursor: url.searchParams.get("cursor"),
            limit: 20,
          })
        : Promise.resolve({ hasCursor: false, items: [], nextCursor: null }),
    ]);

  if (!user) {
    throw redirect(303, buildSignInPageUrl(`${url.pathname}${url.search}`));
  }

  const accountProviders = buildSettingsAccountProviders(
    accounts,
    ustcIdentities,
  );

  return {
    tab,
    message: [
      "AccountDisconnected",
      "AuthorizationRevoked",
      "CalendarTokenRotated",
      "Success",
    ].includes(url.searchParams.get("message") ?? "")
      ? url.searchParams.get("message")
      : null,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
      profilePictures: user.profilePictures,
      accountCount: accounts.length,
    },
    accounts: accountProviders,
    authorizations,
    securityActivity,
  };
}
