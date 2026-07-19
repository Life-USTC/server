import { redirect } from "@sveltejs/kit";
import { listUserOAuthAuthorizations } from "@/features/oauth/server/user-authorizations.server";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import { buildSettingsAccountProviders } from "@/features/settings/server/settings-account-providers";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { prisma } from "@/lib/db/prisma";

export type SettingsAccountProvider = {
  id: "oidc" | "github" | "google";
  name: string;
  linked: boolean;
  accountId: string | null;
  providerAccountId: string | null;
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
  const [user, authorizations] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        profilePictures: true,
        accounts: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            provider: true,
            providerAccountId: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            comments: true,
            todos: true,
            uploads: true,
            subscribedSections: true,
          },
        },
      },
    }),
    tab === "authorizations"
      ? listUserOAuthAuthorizations(sessionUser.id)
      : Promise.resolve([]),
  ]);

  if (!user) {
    throw redirect(303, buildSignInPageUrl(`${url.pathname}${url.search}`));
  }

  const accounts = buildSettingsAccountProviders(user.accounts);

  return {
    tab,
    message: [
      "AccountDisconnected",
      "AuthorizationRevoked",
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
      counts: user._count,
      accountCount: user.accounts.length,
    },
    accounts,
    authorizations,
  };
}
