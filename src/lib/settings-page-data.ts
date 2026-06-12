import { redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { buildSettingsAccountProviders } from "@/lib/settings-account-providers";

export const SETTINGS_TABS = [
  "profile",
  "accounts",
  "content",
  "danger",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export type SettingsAccountProvider = {
  id: "oidc" | "github" | "google";
  name: string;
  linked: boolean;
  accountId: string | null;
  providerAccountId: string | null;
};

export function normalizeSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab)
    ? (value as SettingsTab)
    : "profile";
}

export async function requireSettingsUser(request: Request, url: URL) {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    const callback = `${url.pathname}${url.search}`;
    throw redirect(303, buildSignInPageUrl(callback));
  }
  return session.user;
}

export async function getSettingsPageData(request: Request, url: URL) {
  const sessionUser = await requireSettingsUser(request, url);
  const { prisma } = await import("@/lib/db/prisma");
  const user = await prisma.user.findUnique({
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
  });

  if (!user) {
    throw redirect(303, buildSignInPageUrl(`${url.pathname}${url.search}`));
  }

  const accounts = buildSettingsAccountProviders(user.accounts);

  return {
    tab: normalizeSettingsTab(url.searchParams.get("tab")),
    message: ["AccountDisconnected", "Success"].includes(
      url.searchParams.get("message") ?? "",
    )
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
  };
}
