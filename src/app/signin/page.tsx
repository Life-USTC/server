import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { allowDebugAuth } from "@/lib/auth/auth-config";
import {
  resolveAuthRedirectTarget,
  resolveSignInCallbackUrl,
} from "@/lib/auth/auth-routing";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
  getSignInProviderIds,
  OIDC_PROVIDER_ID,
} from "@/lib/auth/provider-ids";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("pages.signIn"),
  };
}

async function signInWithProvider(formData: FormData) {
  "use server";

  const providerId = String(formData.get("providerId") ?? "");
  const callbackUrl = formData.get("callbackUrl");
  const redirectTo = resolveAuthRedirectTarget(
    {
      callbackUrl: typeof callbackUrl === "string" ? callbackUrl : undefined,
    },
    "/",
  );

  await signIn(providerId, { redirectTo });
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const callbackUrl = resolveSignInCallbackUrl(params);

  if (session?.user) {
    redirect(callbackUrl);
  }

  const t = await getTranslations("signIn");
  const showDebugProviders = allowDebugAuth;
  const providerNames = {
    [OIDC_PROVIDER_ID]: "USTC",
    github: "GitHub",
    google: "Google",
    [DEV_DEBUG_PROVIDER_ID]: t("devDebugProvider"),
    [DEV_ADMIN_PROVIDER_ID]: t("devAdminProvider"),
  } satisfies Record<ReturnType<typeof getSignInProviderIds>[number], string>;
  const providers = getSignInProviderIds(showDebugProviders).map((id) => ({
    id,
    name: providerNames[id],
  }));

  return (
    <main className="page-main flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardPanel className="space-y-4">
          {params.error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
              {params.error === "OAuthAccountNotLinked"
                ? t("errorAccountNotLinked")
                : t("errorGeneric")}
            </div>
          ) : null}

          {providers.map((provider) => (
            <form
              key={provider.id}
              action={signInWithProvider}
              className="flex w-full flex-col gap-4"
            >
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <Button
                type="submit"
                variant="outline"
                className="h-11 w-full justify-center"
              >
                {t("signInWith", { provider: provider.name })}
              </Button>
            </form>
          ))}

          {showDebugProviders ? (
            <p className="text-center text-muted-foreground text-xs">
              {t("devDebugHint")}
            </p>
          ) : null}

          <p className="pt-2 text-center text-muted-foreground text-xs">
            {t.rich("termsNotice", {
              terms: (chunks) => (
                <Link href="/terms" className="underline underline-offset-2">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" className="underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </CardPanel>
      </Card>
    </main>
  );
}
