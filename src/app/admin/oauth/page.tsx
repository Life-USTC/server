import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageBreadcrumbs, PageLayout } from "@/components/page-layout";
import { requireAdminPage } from "@/lib/admin-utils";
import { prisma } from "@/lib/db/prisma";
import { OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD } from "@/lib/oauth/constants";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { OAuthClientManager } from "./oauth-client-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("oauth");
  return { title: t("adminTitle") };
}

export const dynamic = "force-dynamic";

export default async function AdminOAuthPage() {
  const admin = await requireAdminPage("/admin/oauth");
  if (!admin) {
    notFound();
  }

  const [clients, t, tCommon, tAdmin] = await Promise.all([
    prisma.oAuthClient.findMany({
      select: {
        clientId: true,
        name: true,
        tokenEndpointAuthMethod: true,
        redirectUris: true,
        scopes: true,
        grantTypes: true,
        responseTypes: true,
        public: true,
        requirePKCE: true,
        skipConsent: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getTranslations("oauth"),
    getTranslations("common"),
    getTranslations("admin"),
  ]);

  return (
    <PageLayout
      title={t("adminTitle")}
      description={t("adminSubtitle")}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: tCommon("home"), href: "/" },
            { label: tAdmin("title"), href: "/admin" },
            { label: t("adminTitle") },
          ]}
        />
      }
    >
      <OAuthClientManager
        clients={clients.map((c) => ({
          clientId: c.clientId,
          name: c.name ?? "",
          tokenEndpointAuthMethod:
            c.tokenEndpointAuthMethod ?? OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
          redirectUris: c.redirectUris,
          scopes: c.scopes,
          isTrusted: Boolean(c.skipConsent),
          createdAt: toShanghaiIsoString(c.createdAt),
        }))}
      />
    </PageLayout>
  );
}
